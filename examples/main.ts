/**
 * Axial2.5D Examples - app entry.
 *
 * Renders the navigation list and routes between demos using the URL hash
 * (#/<demo-id>). Each demo is a self-contained module under ./demos that
 * builds its own DOM and returns a cleanup function (see demos/types.ts).
 */

import type { Demo } from './demos/types';
import { standaloneDemo } from './demos/standalone';
import { frameworkDemo } from './demos/framework';
import { phase5Demo } from './demos/phase5';
import { phase6Demo } from './demos/phase6';

/** Demo registry - order defines the navigation order */
const demos: Demo[] = [
  standaloneDemo,
  frameworkDemo,
  phase5Demo,
  phase6Demo
];

const navList = document.getElementById('nav-list')!;
const root = document.getElementById('demo-root')!;

let dispose: (() => void) | null = null;
let currentId: string | null = null;

function demoIdFromHash(): string {
  return location.hash.replace(/^#\/?/, '');
}

function switchDemo(id: string): void {
  const demo = demos.find(d => d.id === id) ?? demos[0];
  if (demo.id === currentId) return;

  // Unmount previous demo (stop loop, remove listeners)
  if (dispose) {
    dispose();
    dispose = null;
  }
  root.innerHTML = '';

  currentId = demo.id;

  // Highlight active nav item
  for (const item of Array.from(navList.querySelectorAll<HTMLElement>('.nav-item'))) {
    item.classList.toggle('active', item.dataset.demoId === demo.id);
  }

  document.title = `${demo.title} · Axial2.5D Examples`;
  dispose = demo.mount(root);
}

// Build the navigation list
for (const demo of demos) {
  const li = document.createElement('li');
  li.className = 'nav-item';
  li.dataset.demoId = demo.id;

  const title = document.createElement('div');
  title.className = 'nav-item-title';
  title.textContent = demo.title;

  const desc = document.createElement('div');
  desc.className = 'nav-item-desc';
  desc.textContent = demo.description;

  li.appendChild(title);
  li.appendChild(desc);
  li.addEventListener('click', () => {
    location.hash = `#/${demo.id}`;
  });
  navList.appendChild(li);
}

window.addEventListener('hashchange', () => switchDemo(demoIdFromHash()));

// Initial route (default to the first demo)
const initialId = demoIdFromHash() || demos[0].id;
if (!location.hash) {
  history.replaceState(null, '', `#/${initialId}`);
}
switchDemo(initialId);
