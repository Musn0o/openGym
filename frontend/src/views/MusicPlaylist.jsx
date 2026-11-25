import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import { Button, Row, Section, SearchField, SelectRow } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { useMusic, setMusic, getMusic } from '../lib/music-store.js'
import { SORTS, playlistTracks, removePlaylist, removeTrack, renamePlaylist, renameTrack, setActivePlaylist, setLastPlaylist, setPlaylistSort } from '../lib/music.js'
import { playMusicPlaylist, removeMusicFile } from '../lib/music-player.js'
import { confirmSheet, menuSheet } from '../sheets.jsx'
import { useUI } from '../store/useUI.js'
import { MiniPlayer, SongPicker, promptSheet } from '../components/MusicSettings.jsx'

const SORT_LABEL = {
  custom: () => t('List order'),
  name: () => t('Name A-Z'),
  duration: () => t('Duration'),
  recent: () => t('Recently added'),
}

export default function MusicPlaylist() {
  const nav = useNavigate()
  const { id } = useParams()
  const music = useMusic()
  const [q, setQ] = useState('')
  const p = music.playlists.find(x => x.id === id)
  if (!p) return <div className="narrow"><div className="hdr">
    <button className="iconbtn" data-back="/settings/music" onClick={() => nav('/settings/music')} aria-label={t('Music')}><Icon name="chevronLeft" /></button>
  </div><div className="empty">{t('This playlist is gone.')}</div></div>

  const sort = music.sorts[id] || 'custom'
  const tracks = playlistTracks(music, id)
  const shown = useMemo(() => tracks.filter(x => !q.trim() || x.name.toLowerCase().includes(q.toLowerCase())), [tracks, q])
  const active = music.active || music.last

  const openPicker = () => useUI.getState().openSheet(close => <SongPicker playlist={getMusic().playlists.find(x => x.id === id) || p} onClose={close} />)

  const rename = () => promptSheet({ title: t('Rename playlist'), label: t('Name'), value: p.name, confirmText: t('Save'), onConfirm: name => setMusic(m => renamePlaylist(m, id, name || p.name)) })
  const remove = () => confirmSheet({
    title: t('Delete playlist?'), message: t('This removes the playlist from openGym.'), confirmText: t('Delete'), danger: true,
    onConfirm: () => { setMusic(m => removePlaylist(m, id)); nav('/settings/music') },
  })
  const select = () => setMusic(m => ({ ...setActivePlaylist(setLastPlaylist(m, id), id), last: id }))
  const play = index => { select(); playMusicPlaylist(id, typeof index === 'number' ? index : null) }

  const playlistMenu = () => menuSheet({
    title: p.name,
    items: [
      { icon: 'play', label: t('Play'), onClick: () => play() },
      { icon: 'check', label: t('Select for workout'), onClick: select },
      { icon: 'music', label: t('Add device music'), onClick: openPicker },
      { icon: 'pencil', label: t('Rename playlist'), onClick: rename },
      { icon: 'trash', label: t('Delete playlist'), danger: true, onClick: remove },
    ],
  })

  const trackMenu = track => menuSheet({
    title: track.name,
    items: [
      { icon: 'play', label: t('Play from here'), onClick: () => play(tracks.findIndex(x => x.id === track.id)) },
      { icon: 'pencil', label: t('Rename song'), onClick: () => promptSheet({ title: t('Rename song'), label: t('Song name'), value: track.name, confirmText: t('Save'), onConfirm: name => setMusic(m => renameTrack(m, id, track.id, name)) }) },
      { icon: 'trash', label: t('Remove from playlist'), danger: true, onClick: () => { setMusic(m => removeTrack(m, id, track.id)); if (track.src) removeMusicFile(track.src) } },
    ],
  })

  const fmtDur = n => n ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` : ''

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" data-back="/settings/music" onClick={() => nav('/settings/music')} aria-label={t('Music')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, margin: '0 12px', minWidth: 0 }}>
        <div className="tt" style={{ fontSize: 'var(--fs-title3)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
        <div className="ss">{t('{0} songs', p.tracks.length)}{id === active ? ` · ${t('Selected for workout')}` : ''}</div>
      </div>
      <button className="iconbtn" aria-label={t('Playlist options')} onClick={playlistMenu}><Icon name="more" /></button>
    </div>

    <MiniPlayer />

    <div className="row" style={{ gap: 8, padding: '0 16px 12px', flexWrap: 'wrap' }}>
      <Button size="sm" variant="primary" icon="play" onClick={() => play()}>{t('Play')}</Button>
      <Button size="sm" variant="tinted" icon="check" onClick={select}>{id === active ? t('Selected for workout') : t('Select for workout')}</Button>
      <Button size="sm" variant="plain" icon="plus" onClick={openPicker}>{t('Add device music')}</Button>
    </div>

    <Section>
      <SelectRow icon="swap" iconTint="var(--grey)" title={t('Sort')} value={SORT_LABEL[sort]()}
        options={SORTS.map(s => ({ value: s, label: SORT_LABEL[s]() }))}
        onChange={v => setMusic(m => setPlaylistSort(m, id, v))} />
      <SearchField value={q} onChange={setQ} onClear={() => setQ('')} placeholder={t('Search songs')} />
    </Section>

    <Section title={t('Songs')} footer={t('Sorting changes the order songs play in this playlist.')}>
      {shown.map(track => <Row key={track.id} icon="music" iconTint="var(--grey)" title={track.name} subtitle={fmtDur(track.dur)} accessory="chevron" onClick={() => trackMenu(track)} />)}
      {shown.length === 0 && <Row icon="music" title={q ? t('No matching songs') : t('No songs yet')} subtitle={t('Add device music to fill this playlist.')} />}
    </Section>
  </div>
}
