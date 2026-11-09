/** Public book facts only; never put storage keys or activation secrets here. */
export const BOOK_SLUG = 'jij-fien-en-een-toverkist-vol-superkrachten';
export const BOOK_TITLE = 'Jij, Fien en een toverkist vol superkrachten';
export const BOOK_PATH = `/boeken/${BOOK_SLUG}`;
export const BOOK_LIBRARY_PATH = `/aankopen/boeken/${BOOK_SLUG}`;
export const BOOK_COVER = '/images/books/jij-fien-omslag.webp';
export const isEbook = (product: {slug?:string;product_slug?:string}) => (product.slug || product.product_slug) === BOOK_SLUG;
