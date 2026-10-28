// Fa partire le animazioni d'ingresso (classe `is-in`) quando un elemento con `data-reveal`
// entra nello schermo. Una sola volta per elemento. Gli stili sono in src/styles/motion.css.

const SELECTOR = '[data-reveal]';

export function initReveal(root: ParentNode = document) {
  const items = [...root.querySelectorAll<HTMLElement>(SELECTOR)].filter((el) => !el.classList.contains('is-in'));
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.25, rootMargin: '0px 0px -8% 0px' },
  );
  items.forEach((el) => observer.observe(el));
}

/** true se la persona ha chiesto di ridurre il movimento. */
export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
