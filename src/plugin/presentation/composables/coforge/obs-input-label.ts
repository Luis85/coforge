const labels: Record<string, string> = {
  browser_source: "Browser overlay",
  image_source: "Image",
  ffmpeg_source: "Audio / video file",
  text_gdiplus_v2: "Text",
  text_gdiplus_v3: 'Text',
  text_ft2_source_v2: "Text",
  wasapi_input_capture: "Microphone / audio input",
  wasapi_output_capture: "Desktop audio",
  wasapi_process_output_capture: "Application audio",
  dshow_input: "Camera / capture card",
  window_capture: "Application window",
  game_capture: "Game",
  monitor_capture: "Display",
  color_source_v3: "Color background",
  pulse_input_capture: "Microphone / audio input",
  pulse_output_capture: "Desktop audio",
  v4l2_input: "Camera",
  av_capture_input: "Camera",
  coreaudio_input_capture: "Microphone / audio input",
  coreaudio_output_capture: "Desktop audio",
  screen_capture: "Screen / application",
};
export const obsInputLabel = (kind: string) => labels[kind] ?? kind;
export function obsInputInitialProperty(kind: string) {
  if (kind.includes("browser")) return "url";
  if (kind.includes("text")) return "text";
  if (kind.includes("image")) return "file";
  if (kind.includes("ffmpeg")) return "local_file";
  if (kind === "dshow_input") return "video_device_id";
  if (kind === "av_capture_input") return "device";
  if (kind === "monitor_capture") return "monitor_id";
  if (kind === "screen_capture") return "display";
  if (
    kind === "window_capture" ||
    kind === "game_capture" ||
    kind === "wasapi_process_output_capture"
  )
    return "window";
  return "device_id";
}
