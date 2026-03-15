import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'pka2xml',
  description: 'Decrypt and encrypt Packet Tracer .pka / .pkt files online — no installation required.',
  base: '/pka2xml/',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/pka2xml/favicon.svg' }],
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
