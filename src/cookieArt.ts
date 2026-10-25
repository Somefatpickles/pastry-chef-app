export const cookieArt = [
  { id: 'chocolate-chip', label: 'Chocolate chip cookie', src: '/cookies/chocolate-chip.webp' },
  { id: 'snickerdoodle', label: 'Snickerdoodle cookie', src: '/cookies/snickerdoodle.webp' },
  { id: 'white-chocolate-macadamia', label: 'White chocolate macadamia nut cookie', src: '/cookies/white-chocolate-macadamia.webp' },
  { id: 'sugar-cookie', label: 'Frosted sugar cookie', src: '/cookies/sugar-cookie.webp' },
  { id: 'oatmeal-raisin', label: 'Oatmeal raisin cookie', src: '/cookies/oatmeal-raisin.webp' },
  { id: 'peanut-butter', label: 'Peanut butter cookie', src: '/cookies/peanut-butter.webp' },
  { id: 'double-chocolate', label: 'Double chocolate cookie', src: '/cookies/double-chocolate.webp' },
  { id: 'ginger-molasses', label: 'Ginger molasses cookie', src: '/cookies/ginger-molasses.webp' },
  { id: 'lemon-crinkle', label: 'Lemon crinkle cookie', src: '/cookies/lemon-crinkle.webp' },
  { id: 'red-velvet', label: 'Red velvet cookie', src: '/cookies/red-velvet.webp' },
  { id: 'raspberry-thumbprint', label: 'Raspberry thumbprint cookie', src: '/cookies/raspberry-thumbprint.webp' },
  { id: 'shortbread', label: 'Shortbread cookie', src: '/cookies/shortbread.webp' },
] as const;

export type CookieArtwork = typeof cookieArt[number];
