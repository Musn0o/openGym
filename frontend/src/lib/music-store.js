// Device-local music library. Not synced: audio files are local, metadata stays with them.
import { useSyncExternalStore } from 'react'
import { MUSIC_DIR, musicOf } from './music.js'

const KEY = 'gym_music_v1'
const EMPTY = { playlists: [], last: null, active: null }
let state = load()
const subs = new Set()

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    return musicOf({ music: JSON.parse(raw) })
  } catch { return EMPTY }
}

function save(next) {
  state = musicOf({ music: next })
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch {}
  subs.forEach(fn => fn())
}

export const getMusic = () => state
export const setMusic = next => save(typeof next === 'function' ? next(state) : next)
export const subscribeMusic = fn => { subs.add(fn); return () => subs.delete(fn) }
export const useMusic = () => useSyncExternalStore(subscribeMusic, getMusic, getMusic)
export { MUSIC_DIR }
