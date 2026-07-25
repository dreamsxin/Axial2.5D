/**
 * Demo contract for the Axial2.5D examples app.
 *
 * Every demo is a self-contained module: it receives a container element,
 * builds its own DOM, starts its own loop, and returns a cleanup function
 * that MUST stop the loop and release all listeners/resources.
 */
export interface Demo {
  /** Unique id, used for hash routing (#/<id>) */
  id: string;
  /** Short title shown in the navigation list */
  title: string;
  /** One-line description shown under the title */
  description: string;
  /**
   * Mount the demo into `container`.
   * @returns cleanup function called before switching to another demo
   */
  mount(container: HTMLElement): () => void;
}
