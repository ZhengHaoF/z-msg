export const iconPaths = {
  plus: 'M12 5v14M5 12h14',
  download: 'M12 3v12m0 0 4-4m-4 4-4-4M5 21h14',
  share:
    'M8.6 13.4 15.4 17M15.4 7 8.6 10.6M18 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM18 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  trash: 'M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13',
  copy: 'M9 9h10v10H9zM5 15H4V4h11v1',
  send: 'm4 12 16-8-6 16-2.5-6.5L4 12Z',
  back: 'M15 18l-6-6 6-6',
  check: 'm5 12 4 4L19 6',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  alert:
    'M12 8v5m0 3h.01M10.3 3.9 2.5 17.5A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  close: 'M6 6l12 12M18 6 6 18',
  lock: 'M6 11h12v9H6zM9 11V7a3 3 0 0 1 6 0v4',
  wifi: 'M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01',
  settings: 'M4 6h4M12 6h8M4 12h10M18 12h2M4 18h6M14 18h6M10 4v4M16 10v4M10 16v4',
  arrowDown: 'M12 5v14m0 0 6-6m-6 6-6-6',
  info: 'M12 11v5m0-9h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  key: 'M15 7a4 4 0 1 1-3.5 5.9L7 17.4V19H5v-2l-1 1-1.4-1.4L9.1 10A4 4 0 0 1 15 7Z',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
} as const

export type IconName = keyof typeof iconPaths
