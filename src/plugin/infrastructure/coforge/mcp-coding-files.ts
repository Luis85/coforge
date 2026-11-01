import { constants } from 'node:fs';
import { copyFile, lstat, readFile, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { list, optional, shape, text } from '../../features/coforge/domain/check';
import { McpToolError } from './mcp-errors';

export const codingFileHash = (content: string | Uint8Array) => createHash('sha256').update(content).digest('hex');
interface CodingFiles {
  bound(path: string, missing?: boolean): Promise<string>;
  read(path: string): Promise<string>;
  write(path: string, content: string, expected: string): Promise<unknown>;
  prepareParent(path: string): Promise<void>;
  validate(): Promise<void>;
}
const path = text({ min: 1, max: 1000 }), taskId = optional(text({ min: 1, max: 160 }));
const digest = text({ pattern: /^[a-f0-9]{64}$/u });

/** Optional coding operations reuse the same canonical path and optimistic write boundary. */
export async function codingFileOperation(name: string, raw: unknown, files: CodingFiles): Promise<unknown> {
  if (name === 'coforge_apply_patch') {
    const input = shape({ taskId, path, expectedSha256: digest, edits: list(shape({ oldText: text({ min: 1, max: 200000 }), newText: text({ max: 200000 }) }, { strict: true }), { min: 1, max: 100 }) }, { strict: true })(raw);
    const before = await files.read(await files.bound(input.path));
    if (codingFileHash(before) !== input.expectedSha256) throw new McpToolError('CONFLICT', 'File changed. Read its current content and SHA-256 before applying a patch.', 'coforge_read_file');
    let after = before;
    for (const edit of input.edits) {
      const index = after.indexOf(edit.oldText);
      if (index < 0 || after.indexOf(edit.oldText, index + 1) >= 0) throw new McpToolError('CONFLICT', 'A patch target is missing or ambiguous; no edits were written.', 'coforge_read_file');
      after = after.slice(0, index) + edit.newText + after.slice(index + edit.oldText.length);
      if (Buffer.byteLength(after) > 200000 || after.includes('\0')) throw new McpToolError('INVALID_ARGUMENTS', 'Patched file exceeds the text-file boundary.');
    }
    await files.validate();
    await files.write(input.path, after, before);
    return { path: input.path, written: true, sha256: codingFileHash(after) };
  }
  if (name === 'coforge_move_file') {
    const input = shape({ taskId, path, destination: path, expectedSha256: digest }, { strict: true })(raw);
    if (input.path === input.destination) throw new McpToolError('INVALID_ARGUMENTS', 'Source and destination must differ.');
    const source = await files.bound(input.path), target = await files.bound(input.destination, true);
    const before = await files.read(source);
    if (codingFileHash(before) !== input.expectedSha256) throw new McpToolError('CONFLICT', 'Source changed. Read it before moving.', 'coforge_read_file');
    await files.validate(); await files.prepareParent(input.destination);
    // Exclusive destination creation preserves an independently created destination on both platforms.
    await copyFile(source, target, constants.COPYFILE_EXCL);
    if (await files.read(source) !== before) throw new McpToolError('CONFLICT', 'Source changed during move. Both files were preserved; inspect them before retrying.', 'coforge_list_files');
    await files.validate(); await unlink(source);
    return { path: input.path, destination: input.destination, moved: true, sha256: input.expectedSha256 };
  }
  const input = shape({ taskId, path }, { strict: true })(raw);
  const target = await files.bound(input.path); const info = await lstat(target);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > 2 * 1024 * 1024) throw new McpToolError('INVALID_ARGUMENTS', 'Artifact must be a bounded regular file.');
  const data = await readFile(target);
  if (data.length > 2 * 1024 * 1024) throw new McpToolError('INVALID_ARGUMENTS', 'Artifact exceeds its size limit.');
  const image = imageMetadata(data);
  if (image) return { kind: 'image', path: input.path, ...image, data: data.toString('base64'), sha256: codingFileHash(data) };
  const content = await files.read(target);
  return { kind: 'text', path: input.path, content, sha256: codingFileHash(content) };
}

function imageMetadata(data: Buffer): { mimeType: string; width: number; height: number } | undefined {
  let mimeType = '', width = 0, height = 0;
  if (data.length >= 24 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    mimeType = 'image/png'; width = data.readUInt32BE(16); height = data.readUInt32BE(20);
  } else if (data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') {
    mimeType = 'image/webp'; ({ width, height } = webpDimensions(data));
  } else if (data[0] === 255 && data[1] === 216) {
    for (let offset = 2; offset + 4 <= data.length;) {
      if (data[offset] !== 255) break;
      const marker = data[offset + 1]!; const size = data.readUInt16BE(offset + 2);
      if (size < 2 || offset + size + 2 > data.length) break;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && size >= 7) {
        mimeType = 'image/jpeg'; height = data.readUInt16BE(offset + 5); width = data.readUInt16BE(offset + 7); break;
      }
      offset += size + 2;
    }
  }
  if (!mimeType) return;
  if (!width || !height || width * height > 16 * 1024 * 1024) throw new McpToolError('INVALID_ARGUMENTS', 'Image dimensions exceed the artifact limit.');
  return { mimeType, width, height };
}

/** RIFF framing and uncompressed dimensions only; decoding remains with the image client. */
function webpDimensions(data: Buffer): { width: number; height: number } {
  const invalid = () => new McpToolError('INVALID_ARGUMENTS', 'WebP image header is invalid or truncated.');
  const end = data.readUInt32LE(4) + 8;
  if (data.length < 20 || end > data.length || end < 20 || end % 2) throw invalid();
  const size = data.readUInt32LE(16), paddedEnd = 20 + size + (size % 2);
  if (paddedEnd > end || size % 2 && data[paddedEnd - 1] !== 0) throw invalid();
  const chunk = data.toString('ascii', 12, 16);
  // https://developers.google.com/speed/webp/docs/riff_container
  if (chunk === 'VP8X') {
    if (size !== 10 || data[20]! & 0xc1 || data.readUIntLE(21, 3)) throw invalid();
    return { width: data.readUIntLE(24, 3) + 1, height: data.readUIntLE(27, 3) + 1 };
  }
  if (chunk === 'VP8 ') {
    if (size < 10 || data[20]! & 1 || !data.subarray(23, 26).equals(Buffer.from([157, 1, 42]))) throw invalid();
    return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    if (size < 5 || data[20] !== 47 || data[24]! & 0xe0) throw invalid();
    const bits = data.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  throw invalid();
}
