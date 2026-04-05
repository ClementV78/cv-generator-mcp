import { STORAGE_KEY } from "./constants";
import { deepClone } from "./model";
import type { CvData } from "./types";

type Listener = (state: CvData) => void;
type Mutator = (draft: CvData) => void;

export class CvStore {
  private state: CvData;
  private listeners = new Set<Listener>();

  constructor(initialState: CvData) {
    this.state = deepClone(initialState);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  getState(): CvData {
    return deepClone(this.state);
  }

  replace(nextState: CvData): void {
    this.state = deepClone(nextState);
    this.persist();
    this.emit();
  }

  update(mutator: Mutator): void {
    const draft = deepClone(this.state);
    mutator(draft);
    this.state = draft;
    this.persist();
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }
}
