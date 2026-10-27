const PALETTE = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0d9488', '#4f46e5']

export function avatarColor(id: string): string {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}

export function roomInitial(name: string): string {
  return name.trim().slice(0, 1) || '#'
}
