// Segna con `is-loaded` i contenitori la cui immagine è scaricata e già decodificata, così le animazioni
// d'ingresso partono solo quando la foto è pronta: sui telefoni la decodifica a metà animazione la fa scattare.
// Se l'immagine non arriva, il contenitore prende `is-broken` e sparisce.

export function whenImagesReady(selector: string) {
  for (const box of document.querySelectorAll<HTMLElement>(selector)) {
    const img = box.querySelector('img');
    if (!img) continue;
    const ready = () => img.decode().catch(() => {}).then(() => box.classList.add('is-loaded'));
    if (img.complete) {
      if (img.naturalWidth) ready();
      else box.classList.add('is-broken');
      continue;
    }
    img.addEventListener('load', ready, { once: true });
    img.addEventListener('error', () => box.classList.add('is-broken'), { once: true });
  }
}
