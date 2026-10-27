import { Plugin } from 'obsidian';
import { initializeProject } from "./generated/bootstrap/install.ts";
import './styles/app.css';
import "./generated/styles/project.css";
export default class GeneratedPlugin extends Plugin {
  private runtime?: Awaited<ReturnType<typeof initializeProject>>;
  private lifecycle = 0;
  async onload(): Promise<void> {
    const lifecycle = ++this.lifecycle;
    const current = () => lifecycle === this.lifecycle;
    const runtime = await initializeProject(this, current);
    if (current()) this.runtime = runtime;
    else runtime.dispose();
  }
  onunload(): void {
    this.lifecycle++;
    this.runtime?.dispose();
    this.runtime = undefined;
  }
}
