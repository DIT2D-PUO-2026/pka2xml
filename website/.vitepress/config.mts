import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'pka2xml',
  description: 'Decrypt and encrypt Packet Tracer .pka / .pkt files online — no installation required.',
  base: '/pka2xml/',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/pka2xml/favicon.svg' }],

    // Open Graph
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'pka2xml' }],
    ['meta', { property: 'og:description', content: 'Decrypt and encrypt Packet Tracer .pka / .pkt files online — no installation required.' }],
    ['meta', { property: 'og:url', content: 'https://dit2d-puo-2026.github.io/pka2xml/' }],
    ['meta', { property: 'og:image', content: 'https://dit2d-puo-2026.github.io/pka2xml/meta.svg' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],

    // Twitter / X Card
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'pka2xml' }],
    ['meta', { name: 'twitter:description', content: 'Decrypt and encrypt Packet Tracer .pka / .pkt files online — no installation required.' }],
    ['meta', { name: 'twitter:image', content: 'https://dit2d-puo-2026.github.io/pka2xml/meta.svg' }],
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide' },
      { text: 'Tool', link: '/tool' },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Introduction', link: '/guide' },
          { text: 'How It Works', link: '/guide#how-it-works' },
        ],
      },
      {
        text: 'Tools',
        items: [
          { text: 'PKA / PKT Converter', link: '/tool' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/DIT2D-PUO-2026/pka2xml' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © pka2xml contributors',
    },

    search: {
      provider: 'local',
    },
  },
})
