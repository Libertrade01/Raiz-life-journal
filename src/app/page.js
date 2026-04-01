"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import BreathworkApp from './BreathworkApp';

// ═══════════════════════════════════════════════════════════
// THEME PALETTES
// ═══════════════════════════════════════════════════════════

const LIGHT = {
  bg:     '#fdf8f0',
  card:   '#ffffff',
  text:   '#1c1208',
  muted:  '#a08870',
  subtle: '#ede5d8',
  border: 'rgba(0,0,0,0.06)',
  shadow: '0 1px 18px rgba(0,0,0,0.07)',
  overlay:'rgba(0,0,0,0.28)',
  input:  '#f5f0e8',
};

const DARK = {
  bg:     '#160e06',
  card:   '#221508',
  text:   '#f0dcc8',
  muted:  '#7a6050',
  subtle: '#3a2618',
  border: 'rgba(255,255,255,0.07)',
  shadow: '0 1px 18px rgba(0,0,0,0.55)',
  overlay:'rgba(0,0,0,0.65)',
  input:  '#2a1a0c',
};

// ═══════════════════════════════════════════════════════════
// SECTIONS
// ═══════════════════════════════════════════════════════════

const SECTIONS = [
  {
    id:          'thoughts',
    label:       'Thoughts & Feelings',
    navLabel:    'Thoughts',
    placeholder: "What's on your mind?",
    accent:      '#a78bfa',
    lightBg:     '#f5f0ff',
    darkBg:      '#120b1a',
    type:        'journal',
    display:     'blank',
  },
  {
    id:          'ideas',
    label:       'Ideas',
    navLabel:    'Ideas',
    placeholder: "What's the idea?",
    accent:      '#0ea5e9',
    lightBg:     '#eff8ff',
    darkBg:      '#080e1a',
    type:        'feed',
    display:     'largecards',
  },
  {
    id:          'relationships',
    label:       'Relationship',
    navLabel:    'Relationship',
    placeholder: "What's on your heart about your relationship?",
    accent:      '#e879a0',
    lightBg:     '#fef1f7',
    darkBg:      '#1a0b12',
    type:        'journal',
    display:     'blank',
  },
  {
    id:          'todos',
    label:       'To-Do',
    navLabel:    'To-Do',
    placeholder: '',
    accent:      '#22c55e',
    lightBg:     '#f0fdf4',
    darkBg:      '#081508',
    type:        'todos',
  },
];

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function groupByDate(entries) {
  const groups = new Map();
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  entries.forEach(entry => {
    const d = new Date(entry.created_at);
    let label;
    if (d.toDateString() === today.toDateString())         label = 'Today';
    else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
    else label = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(entry);
  });

  return [...groups.entries()];
}

function deadlineBadge(deadline) {
  if (!deadline) return null;
  const diff = (new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24);
  if (diff < 0)  return { text: 'Overdue',  color: '#ef4444' };
  if (diff < 1)  return { text: 'Today',    color: '#f97316' };
  if (diff < 2)  return { text: 'Tomorrow', color: '#eab308' };
  if (diff < 7) {
    return { text: new Date(deadline).toLocaleDateString('en-GB', { weekday: 'short' }), color: '#6b7280' };
  }
  return { text: new Date(deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), color: '#6b7280' };
}

// ═══════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════

function Svg({ size = 22, color = 'currentColor', children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const ThoughtsIcon     = (p) => <Svg {...p}><path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/></Svg>;
const RelationshipIcon = (p) => <Svg {...p}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></Svg>;
const IdeasIcon        = (p) => <Svg {...p}><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></Svg>;
const TodoIcon     = (p) => <Svg {...p}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></Svg>;
const SunIcon      = (p) => <Svg {...p}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></Svg>;
const MoonIcon     = (p) => <Svg {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></Svg>;
const TrashIcon    = (p) => <Svg {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></Svg>;
const PencilIcon   = (p) => <Svg {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></Svg>;
const PlusIcon     = (p) => <Svg {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Svg>;
const RepeatIcon   = (p) => <Svg {...p}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></Svg>;

const NAV_ICONS = [ThoughtsIcon, IdeasIcon, RelationshipIcon, TodoIcon];

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════

function LoginScreen({ onLogin }) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #fdf8f0 0%, #fef1f7 55%, #fff5ee 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 32px',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    }}>
      <div style={{ textAlign: 'center', maxWidth: 340, width: '100%' }}>
        <div style={{
          width: 76,
          height: 76,
          borderRadius: 24,
          background: 'linear-gradient(135deg, #e879a0 0%, #f97316 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 32px',
          boxShadow: '0 10px 36px rgba(232,121,160,0.32)',
          fontSize: 34,
        }}>
          ✦
        </div>

        <h1 style={{ fontSize: 36, fontWeight: 700, color: '#1c1208', margin: '0 0 10px', letterSpacing: '-0.5px' }}>
          Raíz
        </h1>
        <p style={{ fontSize: 16, color: '#a08870', margin: '0 0 52px', lineHeight: 1.6 }}>
          Where your thoughts take root.
        </p>

        <button
          onClick={onLogin}
          style={{
            width: '100%',
            padding: '17px 24px',
            borderRadius: 50,
            background: '#1c1208',
            border: 'none',
            color: '#fdf8f0',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            fontFamily: 'inherit',
            letterSpacing: '0.1px',
          }}
        >
          <GoogleIcon />
          Continue with Google
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════

const EMPTY = {
  thoughts:      { icon: '💭', text: "Start with whatever's on your mind." },
  relationships: { icon: '💕', text: "How's your heart today?" },
  ideas:         { icon: '✦',  text: 'Every big thing starts as a small thought.' },
  todos:         { icon: '✓',  text: 'Nothing here. Nice — or add something.' },
};

function EmptyState({ sectionId, colors }) {
  const { icon, text } = EMPTY[sectionId] || { icon: '·', text: '' };
  return (
    <div style={{ textAlign: 'center', padding: '72px 32px', color: colors.muted, animation: 'fadeIn 0.4s ease' }}>
      <div style={{ fontSize: 44, marginBottom: 18, lineHeight: 1 }}>{icon}</div>
      <p style={{ fontSize: 15, margin: 0, lineHeight: 1.7 }}>{text}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAGS
// ═══════════════════════════════════════════════════════════

function Tags({ tags, accent }) {
  if (!tags?.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
      {tags.map(t => (
        <span key={t} style={{
          fontSize: 11, fontWeight: 600, color: accent,
          background: `${accent}18`, padding: '3px 10px', borderRadius: 50,
        }}>
          {t}
        </span>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ENTRY CARD (Thoughts / Relationships)
// ═══════════════════════════════════════════════════════════

function EntryCard({ entry, expanded, onToggle, onDelete, onEdit, colors, accent }) {
  return (
    <div
      onClick={() => onToggle(entry.id)}
      style={{
        background: colors.card,
        borderRadius: 18,
        padding: '16px 18px',
        boxShadow: colors.shadow,
        marginBottom: 10,
        cursor: 'pointer',
        border: `1px solid ${colors.border}`,
        animation: 'fadeIn 0.3s ease',
      }}
    >
      <p style={{
        color: colors.text, fontSize: 15, lineHeight: 1.7, margin: 0,
        whiteSpace: 'pre-wrap',
        display: expanded ? 'block' : '-webkit-box',
        WebkitLineClamp: expanded ? undefined : 3,
        WebkitBoxOrient: expanded ? undefined : 'vertical',
        overflow: expanded ? 'visible' : 'hidden',
      }}>
        {entry.content}
      </p>

      {expanded && <Tags tags={entry.tags} accent={accent} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <span style={{ fontSize: 12, color: colors.muted, fontWeight: 500 }}>{timeAgo(entry.created_at)}</span>
        {expanded && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={e => { e.stopPropagation(); onEdit(entry); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 8 }}>
              <PencilIcon size={15} color={accent} />
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(entry.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 8 }}>
              <TrashIcon size={16} color="#ef4444" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// BLANK PAGE ENTRY (Thoughts & Feelings)
// ═══════════════════════════════════════════════════════════

function BlankEntry({ entry, expanded, onToggle, onDelete, onEdit, colors, accent }) {
  return (
    <div onClick={() => onToggle(entry.id)} style={{ padding: '0 4px 28px', cursor: 'pointer', animation: 'fadeIn 0.3s ease' }}>
      <p style={{
        color: colors.text, fontSize: 16, lineHeight: 1.85, margin: 0,
        whiteSpace: 'pre-wrap',
        display: expanded ? 'block' : '-webkit-box',
        WebkitLineClamp: expanded ? undefined : 5,
        WebkitBoxOrient: expanded ? undefined : 'vertical',
        overflow: expanded ? 'visible' : 'hidden',
      }}>
        {entry.content}
      </p>
      {expanded && <Tags tags={entry.tags} accent={accent} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <span style={{ fontSize: 12, color: colors.muted, fontWeight: 500 }}>{timeAgo(entry.created_at)}</span>
        {expanded && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={e => { e.stopPropagation(); onEdit(entry); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
              <PencilIcon size={15} color={accent} />
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(entry.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
              <TrashIcon size={15} color="#ef4444" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// LARGE CARD (Ideas)
// ═══════════════════════════════════════════════════════════

function LargeCard({ entry, expanded, onToggle, onDelete, onEdit, colors, accent }) {
  return (
    <div
      onClick={() => onToggle(entry.id)}
      style={{
        background: colors.card,
        borderRadius: 22,
        padding: '22px 22px 18px',
        boxShadow: colors.shadow,
        marginBottom: 16,
        cursor: 'pointer',
        border: `1px solid ${colors.border}`,
        animation: 'fadeIn 0.3s ease',
      }}
    >
      <p style={{
        color: colors.text,
        fontSize: 17,
        lineHeight: 1.8,
        margin: 0,
        whiteSpace: 'pre-wrap',
        display: expanded ? 'block' : '-webkit-box',
        WebkitLineClamp: expanded ? undefined : 5,
        WebkitBoxOrient: expanded ? undefined : 'vertical',
        overflow: expanded ? 'visible' : 'hidden',
      }}>
        {entry.content}
      </p>

      {expanded && <Tags tags={entry.tags} accent={accent} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <span style={{ fontSize: 12, color: colors.muted, fontWeight: 500 }}>{timeAgo(entry.created_at)}</span>
        {expanded && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={e => { e.stopPropagation(); onEdit(entry); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
              <PencilIcon size={15} color={accent} />
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(entry.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
              <TrashIcon size={15} color="#ef4444" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// QUOTE STYLE (Ideas)
// ═══════════════════════════════════════════════════════════

function QuoteEntry({ entry, expanded, onToggle, onDelete, onEdit, colors, accent }) {
  return (
    <div
      onClick={() => onToggle(entry.id)}
      style={{
        padding: '24px 0 20px',
        borderBottom: `1px solid ${colors.border}`,
        cursor: 'pointer',
        animation: 'fadeIn 0.3s ease',
      }}
    >
      {/* Large decorative quote mark */}
      <div style={{
        fontSize: 56,
        lineHeight: 0.8,
        color: accent,
        opacity: 0.35,
        fontFamily: 'Georgia, serif',
        marginBottom: 10,
        userSelect: 'none',
      }}>
        "
      </div>

      <p style={{
        color: colors.text,
        fontSize: 17,
        lineHeight: 1.8,
        margin: 0,
        fontStyle: 'italic',
        whiteSpace: 'pre-wrap',
        display: expanded ? 'block' : '-webkit-box',
        WebkitLineClamp: expanded ? undefined : 5,
        WebkitBoxOrient: expanded ? undefined : 'vertical',
        overflow: expanded ? 'visible' : 'hidden',
      }}>
        {entry.content}
      </p>

      {expanded && <Tags tags={entry.tags} accent={accent} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <span style={{ fontSize: 12, color: colors.muted, fontWeight: 500 }}>{timeAgo(entry.created_at)}</span>
        {expanded && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={e => { e.stopPropagation(); onEdit(entry); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
              <PencilIcon size={15} color={accent} />
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(entry.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
              <TrashIcon size={15} color="#ef4444" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// IDEA CARD (Feed)
// ═══════════════════════════════════════════════════════════

function IdeaCard({ entry, expanded, onToggle, onDelete, onEdit, colors, accent }) {
  return (
    <div
      onClick={() => onToggle(entry.id)}
      style={{
        background: colors.card,
        borderRadius: 18,
        padding: '18px 20px 14px',
        boxShadow: colors.shadow,
        marginBottom: 12,
        cursor: 'pointer',
        border: `1px solid ${colors.border}`,
        borderLeft: `3px solid ${accent}`,
        animation: 'fadeIn 0.3s ease',
      }}
    >
      <p style={{
        color: colors.text, fontSize: 16, lineHeight: 1.7, margin: 0,
        whiteSpace: 'pre-wrap',
        display: expanded ? 'block' : '-webkit-box',
        WebkitLineClamp: expanded ? undefined : 5,
        WebkitBoxOrient: expanded ? undefined : 'vertical',
        overflow: expanded ? 'visible' : 'hidden',
      }}>
        {entry.content}
      </p>

      {expanded && <Tags tags={entry.tags} accent={accent} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <span style={{ fontSize: 12, color: colors.muted, fontWeight: 500 }}>{timeAgo(entry.created_at)}</span>
        {expanded && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={e => { e.stopPropagation(); onEdit(entry); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 8 }}>
              <PencilIcon size={15} color={accent} />
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(entry.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 8 }}>
              <TrashIcon size={16} color="#ef4444" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DELETE CONFIRMATION SHEET
// ═══════════════════════════════════════════════════════════

function ConfirmDelete({ open, onConfirm, onCancel, colors }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: colors.overlay, zIndex: 60, backdropFilter: 'blur(3px)' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, zIndex: 70,
        background: colors.card,
        borderRadius: '24px 24px 0 0',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        boxShadow: '0 -6px 40px rgba(0,0,0,0.18)',
        animation: 'slideUp 0.25s cubic-bezier(0.32,0.72,0,1)',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: colors.subtle }} />
        </div>
        <div style={{ padding: '20px 24px 8px', textAlign: 'center' }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: '0 0 6px' }}>
            Delete this entry?
          </p>
          <p style={{ fontSize: 14, color: colors.muted, margin: '0 0 24px', lineHeight: 1.5 }}>
            This can't be undone.
          </p>
          <button
            onClick={onConfirm}
            style={{
              width: '100%', padding: '15px', borderRadius: 16,
              background: '#ef4444', border: 'none',
              color: '#fff', fontSize: 16, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10,
            }}
          >
            Yes, delete it
          </button>
          <button
            onClick={onCancel}
            style={{
              width: '100%', padding: '15px', borderRadius: 16,
              background: colors.subtle, border: 'none',
              color: colors.text, fontSize: 16, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// TODO ITEM
// ═══════════════════════════════════════════════════════════

function TodoItem({ todo, expanded, onToggle, onCheck, onDelete, onEdit, colors, accent, isDark }) {
  const badge = deadlineBadge(todo.deadline);
  return (
    <div style={{
      background: colors.card,
      borderRadius: 16,
      padding: '14px 16px',
      boxShadow: colors.shadow,
      marginBottom: 8,
      border: `1px solid ${colors.border}`,
      opacity: todo.is_done ? 0.5 : 1,
      transition: 'opacity 0.2s',
      animation: 'fadeIn 0.3s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Checkbox */}
        <button
          onClick={e => { e.stopPropagation(); onCheck(todo.id); }}
          style={{
            width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 1,
            border: todo.is_done ? 'none' : `2px solid ${colors.subtle}`,
            background: todo.is_done ? accent : 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
          }}
        >
          {todo.is_done && (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <polyline points="1.5 5.5 4.5 8.5 9.5 2.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        {/* Text + meta */}
        <div style={{ flex: 1 }} onClick={() => onToggle(todo.id)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{
              fontSize: 15, fontWeight: 500, color: colors.text,
              textDecoration: todo.is_done ? 'line-through' : 'none',
              lineHeight: 1.4,
            }}>
              {todo.title}
            </span>
            {badge && !todo.is_done && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: badge.color,
                background: `${badge.color}20`, padding: '3px 9px', borderRadius: 50,
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                {badge.text}
              </span>
            )}
          </div>

          {expanded && (
            <div style={{ marginTop: 6 }}>
              {todo.notes && (
                <p style={{ fontSize: 13, color: colors.muted, margin: '0 0 8px', lineHeight: 1.55 }}>
                  {todo.notes}
                </p>
              )}
              {todo.is_recurring && todo.recur_interval && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                  <RepeatIcon size={12} color={accent} />
                  <span style={{ fontSize: 12, color: accent, fontWeight: 600, textTransform: 'capitalize' }}>
                    {todo.recur_interval}
                  </span>
                </div>
              )}
              <Tags tags={todo.tags} accent={accent} />
              <div style={{ display: 'flex', gap: 16, paddingTop: 8 }}>
                <button
                  onClick={e => { e.stopPropagation(); onEdit(todo); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: 0, fontFamily: 'inherit' }}
                >
                  <PencilIcon size={13} color={accent} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: accent }}>Edit</span>
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onDelete(todo.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: 0, fontFamily: 'inherit' }}
                >
                  <TrashIcon size={13} color="#ef4444" />
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#ef4444' }}>Delete</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ENTRY BOTTOM SHEET
// ═══════════════════════════════════════════════════════════

function EntrySheet({ open, onClose, onSave, onUpdate, editEntry, section, colors, isDark }) {
  const [content, setContent] = useState('');
  const [tags,    setTags]    = useState('');
  const [saving,  setSaving]  = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (open) {
      setContent(editEntry ? editEntry.content : '');
      setTags(editEntry ? (editEntry.tags || []).join(', ') : '');
      setTimeout(() => ref.current?.focus(), 120);
    }
  }, [open, editEntry]);

  const save = async () => {
    if (!content.trim() || saving) return;
    setSaving(true);
    const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
    if (editEntry) {
      await onUpdate(editEntry.id, content.trim(), parsedTags);
    } else {
      await onSave(content.trim(), parsedTags);
    }
    setSaving(false);
  };

  if (!open) return null;

  const accent = section.accent;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: colors.overlay, zIndex: 40, backdropFilter: 'blur(3px)' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: colors.card,
        borderRadius: '24px 24px 0 0',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
        boxShadow: '0 -6px 40px rgba(0,0,0,0.18)',
        animation: 'slideUp 0.3s cubic-bezier(0.32,0.72,0,1)',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        maxWidth: 430,
        margin: '0 auto',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 2px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: colors.subtle }} />
        </div>

        {/* Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 10px' }}>
          <button onClick={onClose} style={{ fontSize: 15, fontWeight: 500, color: colors.muted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0' }}>
            Cancel
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: accent }}>{editEntry ? 'Edit' : section.label}</span>
          <button
            onClick={save}
            disabled={!content.trim() || saving}
            style={{
              fontSize: 15, fontWeight: 600,
              color: content.trim() ? '#fff' : colors.muted,
              background: content.trim() ? accent : colors.subtle,
              border: 'none', borderRadius: 50, padding: '8px 20px',
              cursor: content.trim() ? 'pointer' : 'default',
              fontFamily: 'inherit', transition: 'all 0.2s',
            }}
          >
            {saving ? 'Saving…' : editEntry ? 'Update' : 'Save'}
          </button>
        </div>

        {/* Textarea */}
        <textarea
          ref={ref}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={section.placeholder}
          style={{
            width: '100%', minHeight: 160, maxHeight: 300,
            padding: '4px 20px', fontSize: 17, lineHeight: 1.7,
            color: colors.text, background: 'transparent',
            border: 'none', outline: 'none', resize: 'none',
            fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />

        {/* Quick tags */}
        {section.id === 'thoughts' && (
          <div style={{ padding: '10px 20px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['Morning Check-in'].map(qt => {
              const active = tags.split(',').map(t => t.trim()).includes(qt);
              return (
                <button
                  key={qt}
                  onClick={() => {
                    if (active) {
                      setTags(tags.split(',').map(t => t.trim()).filter(t => t && t !== qt).join(', '));
                    } else {
                      setTags(t => t.trim() ? `${t.trim()}, ${qt}` : qt);
                    }
                  }}
                  style={{
                    padding: '6px 14px', borderRadius: 50, border: `1.5px solid ${accent}`,
                    background: active ? accent : 'transparent',
                    color: active ? '#fff' : accent,
                    fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >{qt}</button>
              );
            })}
          </div>
        )}

        {/* Tags */}
        <div style={{ padding: '6px 20px 0' }}>
          <input
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="Add tags, comma separated (optional)"
            style={{
              width: '100%', padding: '12px 16px', borderRadius: 14,
              border: `1px solid ${colors.border}`,
              background: colors.input, color: colors.text,
              fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// TODO BOTTOM SHEET
// ═══════════════════════════════════════════════════════════

function TodoSheet({ open, onClose, onSave, onUpdate, editTodo, colors, accent, isDark }) {
  const [title,     setTitle]     = useState('');
  const [notes,     setNotes]     = useState('');
  const [deadline,  setDeadline]  = useState('');
  const [recurring, setRecurring] = useState(false);
  const [interval,  setInterval]  = useState('weekly');
  const [tags,      setTags]      = useState('');
  const [saving,    setSaving]    = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (open) {
      if (editTodo) {
        setTitle(editTodo.title || '');
        setNotes(editTodo.notes || '');
        setDeadline(editTodo.deadline ? editTodo.deadline.slice(0, 16) : '');
        setRecurring(editTodo.is_recurring || false);
        setInterval(editTodo.recur_interval || 'weekly');
        setTags((editTodo.tags || []).join(', '));
      } else {
        setTitle(''); setNotes(''); setDeadline('');
        setRecurring(false); setInterval('weekly'); setTags('');
      }
      setTimeout(() => ref.current?.focus(), 120);
    }
  }, [open, editTodo]);

  const save = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    const payload = {
      title:          title.trim(),
      notes:          notes.trim() || null,
      deadline:       deadline || null,
      is_recurring:   recurring,
      recur_interval: recurring ? interval : null,
      tags:           tags.split(',').map(t => t.trim()).filter(Boolean),
    };
    if (editTodo) {
      await onUpdate(editTodo.id, payload);
    } else {
      await onSave(payload);
    }
    setSaving(false);
  };

  if (!open) return null;

  const field = {
    width: '100%', padding: '13px 16px', borderRadius: 14,
    border: `1px solid ${colors.border}`, background: colors.input,
    color: colors.text, fontSize: 15, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box', marginBottom: 10,
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: colors.overlay, zIndex: 40, backdropFilter: 'blur(3px)' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: colors.card,
        borderRadius: '24px 24px 0 0',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
        boxShadow: '0 -6px 40px rgba(0,0,0,0.18)',
        animation: 'slideUp 0.3s cubic-bezier(0.32,0.72,0,1)',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        maxHeight: '92dvh', overflowY: 'auto',
        maxWidth: 430, margin: '0 auto',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 2px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: colors.subtle }} />
        </div>

        {/* Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 16px' }}>
          <button onClick={onClose} style={{ fontSize: 15, fontWeight: 500, color: colors.muted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!title.trim() || saving}
            style={{
              fontSize: 15, fontWeight: 600,
              color: title.trim() ? '#fff' : colors.muted,
              background: title.trim() ? accent : colors.subtle,
              border: 'none', borderRadius: 50, padding: '8px 20px',
              cursor: title.trim() ? 'pointer' : 'default',
              fontFamily: 'inherit', transition: 'all 0.2s',
            }}
          >
            {saving ? 'Saving…' : editTodo ? 'Update' : 'Add'}
          </button>
        </div>

        <div style={{ padding: '0 20px' }}>
          <input
            ref={ref}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="What needs doing?"
            onKeyDown={e => e.key === 'Enter' && save()}
            style={{ ...field, fontSize: 18, fontWeight: 500 }}
          />

          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            style={{ ...field, resize: 'none', minHeight: 80, lineHeight: 1.55 }}
          />

          <input
            type="datetime-local"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            style={{ ...field, colorScheme: isDark ? 'dark' : 'light' }}
          />

          {/* Recurring toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RepeatIcon size={16} color={recurring ? accent : colors.muted} />
              <span style={{ fontSize: 15, color: recurring ? colors.text : colors.muted, fontWeight: 500 }}>Recurring</span>
            </div>
            <button
              onClick={() => setRecurring(r => !r)}
              style={{
                width: 46, height: 27, borderRadius: 14,
                background: recurring ? accent : colors.subtle,
                border: 'none', cursor: 'pointer', position: 'relative',
                transition: 'background 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: 3.5,
                left: recurring ? 22 : 3.5,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s', boxShadow: '0 1px 5px rgba(0,0,0,0.22)',
              }} />
            </button>
          </div>

          {recurring && (
            <select
              value={interval}
              onChange={e => setInterval(e.target.value)}
              style={{ ...field, appearance: 'none' }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          )}

          <input
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="Tags, comma separated (optional)"
            style={field}
          />
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// LANDING PAGE
// ═══════════════════════════════════════════════════════════

function LandingPage({ isDark, colors, initial, onSelect, onToggleTheme, onLogout }) {
  const bg   = isDark ? '#160e06' : '#fdf8f0';
  const text = colors.text;
  const muted = colors.muted;

  return (
    <div style={{
      minHeight: '100dvh', background: bg,
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      color: text, maxWidth: 430, margin: '0 auto',
      display: 'flex', flexDirection: 'column',
      padding: 'max(24px, env(safe-area-inset-top)) 24px 40px',
    }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12,
            background: 'linear-gradient(135deg, #e879a0 0%, #f97316 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>✦</div>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>Raíz</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onToggleTheme} style={{
            width: 36, height: 36, borderRadius: 50,
            background: isDark ? '#3a2618' : '#ede5d8',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isDark
              ? <SunIcon  size={16} color="#f0dcc8" />
              : <MoonIcon size={16} color="#a08870" />
            }
          </button>
          <button onClick={onLogout} title="Sign out" style={{
            width: 36, height: 36, borderRadius: 50,
            background: isDark ? '#3a2618' : '#ede5d8',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: muted, fontFamily: 'inherit',
          }}>
            {initial}
          </button>
        </div>
      </div>

      {/* Greeting */}
      <h1 style={{ fontSize: 34, fontWeight: 800, color: text, margin: '0 0 48px', letterSpacing: '-1px', lineHeight: 1.1 }}>
        What are we<br />doing today?
      </h1>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        {/* Journal */}
        <button onClick={() => onSelect('journal')} style={{
          width: '100%', borderRadius: 24, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 40%, #fecdd3 100%)',
          padding: '28px 24px', textAlign: 'left', position: 'relative', overflow: 'hidden',
          transition: 'transform 0.15s, box-shadow 0.15s',
          boxShadow: isDark ? 'none' : '0 4px 24px rgba(0,0,0,0.07)',
        }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div style={{ position: 'absolute', right: -10, bottom: -10, fontSize: 90, opacity: 0.13, lineHeight: 1 }}>✦</div>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#92400e', letterSpacing: 1, textTransform: 'uppercase' }}>
            Journal
          </p>
          <p style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: '#78350f', lineHeight: 1.2 }}>
            Thoughts, Ideas<br />&amp; To-Dos
          </p>
          <p style={{ margin: '14px 0 0', fontSize: 13, color: '#a16207' }}>
            4 sections →
          </p>
        </button>

        {/* Breathwork */}
        <button onClick={() => onSelect('breathwork')} style={{
          width: '100%', borderRadius: 24, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 40%, #e0e7ff 100%)',
          padding: '28px 24px', textAlign: 'left', position: 'relative', overflow: 'hidden',
          transition: 'transform 0.15s, box-shadow 0.15s',
          boxShadow: isDark ? 'none' : '0 4px 24px rgba(0,0,0,0.07)',
        }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div style={{ position: 'absolute', right: 8, bottom: -8, fontSize: 90, opacity: 0.12, lineHeight: 1 }}>◎</div>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#0f766e', letterSpacing: 1, textTransform: 'uppercase' }}>
            Breathwork
          </p>
          <p style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: '#134e4a', lineHeight: 1.2 }}>
            Morning, Post-Session<br />&amp; Night Routines
          </p>
          <p style={{ margin: '14px 0 0', fontSize: 13, color: '#0f766e' }}>
            Guided · Timed · Tracked →
          </p>
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════

export default function App() {
  const [isDark,         setIsDark]         = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [session,        setSession]        = useState(null);
  const [appView,        setAppView]        = useState('home'); // 'home' | 'journal' | 'breathwork'
  const [activeTab,      setActiveTab]      = useState(0);
  const [entries,        setEntries]        = useState([]);
  const [todos,          setTodos]          = useState([]);
  const [expandedId,     setExpandedId]     = useState(null);
  const [showEntry,      setShowEntry]      = useState(false);
  const [showTodo,       setShowTodo]       = useState(false);
  const [fetching,       setFetching]       = useState(false);
  const [pendingDelete,  setPendingDelete]  = useState(null); // { id, type: 'entry'|'todo' }
  const [editingEntry,   setEditingEntry]   = useState(null); // entry object being edited
  const [editingTodo,    setEditingTodo]    = useState(null); // todo object being edited

  const section = SECTIONS[activeTab];
  const colors  = isDark ? DARK : LIGHT;
  const bg      = isDark ? section.darkBg : section.lightBg;

  // ── Auth setup ─────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('lj-theme');
    if (saved === 'dark') setIsDark(true);

    // Handle notification tap deep-link (?routine=morning)
    const params = new URLSearchParams(window.location.search);
    const routineParam = params.get('routine');
    if (routineParam) {
      localStorage.setItem('raiz-pending-routine', routineParam);
      setAppView('breathwork');
      window.history.replaceState({}, '', '/');
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login  = () => supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });

  const logout = () => {
    if (window.confirm('Sign out?')) supabase.auth.signOut();
  };

  const toggleTheme = () => {
    setIsDark(d => {
      localStorage.setItem('lj-theme', !d ? 'dark' : 'light');
      return !d;
    });
  };

  // ── Data fetch ─────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    setExpandedId(null);
    setFetching(true);

    if (activeTab < 3) {
      supabase.from('journal_entries')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('section', section.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => { setEntries(data || []); setFetching(false); });
    } else {
      supabase.from('journal_todos')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => { setTodos(data || []); setFetching(false); });
    }
  }, [activeTab, session]);

  // ── Entry CRUD ─────────────────────────────────────────────
  const saveEntry = async (content, tags) => {
    const { data, error } = await supabase.from('journal_entries')
      .insert({ user_id: session.user.id, section: section.id, content, tags })
      .select().single();
    if (!error && data) setEntries(p => [data, ...p]);
    setShowEntry(false);
  };

  const deleteEntry = async (id) => {
    await supabase.from('journal_entries').delete().eq('id', id);
    setEntries(p => p.filter(e => e.id !== id));
    setExpandedId(null);
    setPendingDelete(null);
  };

  const requestDeleteEntry = (id) => setPendingDelete({ id, type: 'entry' });

  const updateEntry = async (id, content, tags) => {
    const { data, error } = await supabase.from('journal_entries')
      .update({ content, tags, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (!error && data) setEntries(p => p.map(e => e.id === id ? data : e));
    setEditingEntry(null);
    setShowEntry(false);
  };

  // ── Todo CRUD ──────────────────────────────────────────────
  const saveTodo = async (payload) => {
    const { data, error } = await supabase.from('journal_todos')
      .insert({ user_id: session.user.id, ...payload })
      .select().single();
    if (!error && data) setTodos(p => [data, ...p]);
    setShowTodo(false);
  };

  const toggleTodo = async (id) => {
    const todo = todos.find(t => t.id === id);
    const done = !todo.is_done;
    await supabase.from('journal_todos')
      .update({ is_done: done, done_at: done ? new Date().toISOString() : null })
      .eq('id', id);
    setTodos(p => p.map(t => t.id === id ? { ...t, is_done: done, done_at: done ? new Date().toISOString() : null } : t));
  };

  const deleteTodo = async (id) => {
    await supabase.from('journal_todos').delete().eq('id', id);
    setTodos(p => p.filter(t => t.id !== id));
    setExpandedId(null);
    setPendingDelete(null);
  };

  const requestDeleteTodo = (id) => setPendingDelete({ id, type: 'todo' });

  const updateTodo = async (id, payload) => {
    const { data, error } = await supabase.from('journal_todos')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (!error && data) setTodos(p => p.map(t => t.id === id ? data : t));
    setEditingTodo(null);
    setShowTodo(false);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.type === 'entry') deleteEntry(pendingDelete.id);
    else deleteTodo(pendingDelete.id);
  };

  const toggleExpanded = (id) => setExpandedId(p => p === id ? null : id);

  // ── Loading / Auth gates ────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: '#fdf8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e879a0', opacity: 0.5 }} />
      </div>
    );
  }

  if (!session) return <LoginScreen onLogin={login} />;

  // Derived data
  const grouped     = groupByDate(entries);
  const activeTodos = todos.filter(t => !t.is_done);
  const doneTodos   = todos.filter(t => t.is_done);
  const initial     = session.user.email?.[0]?.toUpperCase() || '?';

  if (appView === 'home') {
    return (
      <LandingPage
        isDark={isDark}
        colors={colors}
        initial={initial}
        onSelect={setAppView}
        onToggleTheme={toggleTheme}
        onLogout={logout}
      />
    );
  }

  if (appView === 'breathwork') {
    return (
      <BreathworkApp
        session={session}
        isDark={isDark}
        colors={colors}
        toggleTheme={toggleTheme}
        onBack={() => setAppView('home')}
      />
    );
  }

  const NAV_H    = 62;
  const HEADER_H = 70;

  return (
    <div style={{
      minHeight: '100dvh',
      background: bg,
      transition: 'background 0.4s ease',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      color: colors.text,
      position: 'relative',
      overflowX: 'hidden',
      /* centre on desktop, full-width on mobile */
      maxWidth: 430,
      margin: '0 auto',
    }}>

      {/* ── Header ────────────────────────────────────────── */}
      <div style={{
        position: 'fixed',
        top: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430,
        zIndex: 10,
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        padding: `max(16px, env(safe-area-inset-top)) 20px 14px`,
        background: `${bg}d8`,
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setAppView('home')} style={{
            width: 34, height: 34, borderRadius: 50,
            background: `${section.accent}18`, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke={section.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: colors.text, letterSpacing: '-0.3px' }}>
            {section.label}
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={toggleTheme}
            style={{
              background: `${section.accent}18`, border: 'none', borderRadius: 50,
              width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            {isDark
              ? <SunIcon  size={17} color={section.accent} />
              : <MoonIcon size={17} color={section.accent} />
            }
          </button>
          <button
            onClick={logout}
            title="Sign out"
            style={{
              background: colors.subtle, border: 'none', borderRadius: 50,
              width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 14, fontWeight: 700, color: colors.muted, fontFamily: 'inherit',
            }}
          >
            {initial}
          </button>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────── */}
      <div style={{
        paddingTop: `calc(max(16px, env(safe-area-inset-top)) + ${HEADER_H}px)`,
        paddingBottom: `calc(env(safe-area-inset-bottom) + ${NAV_H}px + 20px)`,
        paddingLeft: 16, paddingRight: 16,
      }}>
        {fetching ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: section.accent, opacity: 0.5 }} />
          </div>

        ) : section.display === 'blank' ? (
          /* Blank page — Thoughts & Feelings */
          entries.length === 0 ? <EmptyState sectionId={section.id} colors={colors} /> : (
            grouped.map(([label, group]) => (
              <div key={label}>
                <p style={{ fontSize: 11, fontWeight: 600, color: colors.muted, letterSpacing: 1, textTransform: 'uppercase', margin: '20px 0 16px 4px' }}>
                  {label}
                </p>
                {group.map(entry => (
                  <BlankEntry
                    key={entry.id} entry={entry}
                    expanded={expandedId === entry.id}
                    onToggle={toggleExpanded} onDelete={requestDeleteEntry}
                    onEdit={e => { setEditingEntry(e); setShowEntry(true); }}
                    colors={colors} accent={section.accent}
                  />
                ))}
              </div>
            ))
          )

        ) : section.display === 'largecards' ? (
          /* Large cards — Ideas */
          entries.length === 0 ? <EmptyState sectionId={section.id} colors={colors} /> : (
            <div style={{ paddingTop: 8 }}>
              {entries.map(entry => (
                <LargeCard
                  key={entry.id} entry={entry}
                  expanded={expandedId === entry.id}
                  onToggle={toggleExpanded} onDelete={requestDeleteEntry}
                  onEdit={e => { setEditingEntry(e); setShowEntry(true); }}
                  colors={colors} accent={section.accent}
                />
              ))}
            </div>
          )

        ) : section.display === 'cards' ? (
          /* Cards — Relationship */
          entries.length === 0 ? <EmptyState sectionId={section.id} colors={colors} /> : (
            grouped.map(([label, group]) => (
              <div key={label}>
                <p style={{ fontSize: 11, fontWeight: 600, color: colors.muted, letterSpacing: 1, textTransform: 'uppercase', margin: '20px 0 10px 4px' }}>
                  {label}
                </p>
                {group.map(entry => (
                  <EntryCard
                    key={entry.id} entry={entry}
                    expanded={expandedId === entry.id}
                    onToggle={toggleExpanded} onDelete={requestDeleteEntry}
                    onEdit={e => { setEditingEntry(e); setShowEntry(true); }}
                    colors={colors} accent={section.accent}
                  />
                ))}
              </div>
            ))
          )

        ) : (
          /* To-Do */
          todos.length === 0 ? <EmptyState sectionId={section.id} colors={colors} /> : (
            <div style={{ paddingTop: 8 }}>
              {activeTodos.map(todo => (
                <TodoItem
                  key={todo.id} todo={todo}
                  expanded={expandedId === todo.id}
                  onToggle={toggleExpanded}
                  onCheck={toggleTodo}
                  onDelete={requestDeleteTodo}
                  onEdit={t => { setEditingTodo(t); setShowTodo(true); }}
                  colors={colors} accent={section.accent} isDark={isDark}
                />
              ))}
              {doneTodos.length > 0 && (
                <>
                  <p style={{ fontSize: 11, fontWeight: 600, color: colors.muted, letterSpacing: 1, textTransform: 'uppercase', margin: '22px 0 10px 4px' }}>
                    Done
                  </p>
                  {doneTodos.map(todo => (
                    <TodoItem
                      key={todo.id} todo={todo}
                      expanded={expandedId === todo.id}
                      onToggle={toggleExpanded}
                      onCheck={toggleTodo}
                      onDelete={requestDeleteTodo}
                      onEdit={t => { setEditingTodo(t); setShowTodo(true); }}
                      colors={colors} accent={section.accent} isDark={isDark}
                    />
                  ))}
                </>
              )}
            </div>
          )
        )}
      </div>

      {/* ── FAB ───────────────────────────────────────────── */}
      <button
        onClick={() => activeTab === 3 ? setShowTodo(true) : setShowEntry(true)}
        style={{
          position: 'fixed',
          right: 'max(20px, calc((100vw - 430px) / 2 + 20px))',
          bottom: `calc(env(safe-area-inset-bottom) + ${NAV_H + 16}px)`,
          width: 54, height: 54,
          borderRadius: '50%',
          background: section.accent,
          border: 'none',
          boxShadow: `0 4px 22px ${section.accent}55`,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.35s, box-shadow 0.35s',
          zIndex: 9,
        }}
      >
        <PlusIcon size={22} color="#fff" />
      </button>

      {/* ── Bottom Nav ────────────────────────────────────── */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430,
        zIndex: 10,
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: `${colors.bg}f2`,
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderTop: `1px solid ${colors.border}`,
        display: 'flex',
      }}>
        {SECTIONS.map((s, i) => {
          const active = activeTab === i;
          const NavIcon = NAV_ICONS[i];
          return (
            <button
              key={s.id}
              onClick={() => setActiveTab(i)}
              style={{
                flex: 1, padding: '10px 0 8px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                background: 'none', border: 'none', cursor: 'pointer',
                color: active ? s.accent : colors.muted,
                transition: 'color 0.2s',
              }}
            >
              <NavIcon size={22} color={active ? s.accent : colors.muted} />
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: 0.2, fontFamily: 'inherit' }}>
                {s.navLabel}
              </span>
              {active && (
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: s.accent, marginTop: -2 }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Confirm delete ───────────────────────────────── */}
      <ConfirmDelete
        open={!!pendingDelete}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
        colors={colors}
      />

      {/* ── Sheets ────────────────────────────────────────── */}
      <EntrySheet
        open={showEntry}
        onClose={() => { setShowEntry(false); setEditingEntry(null); }}
        onSave={saveEntry}
        onUpdate={updateEntry}
        editEntry={editingEntry}
        section={section}
        colors={colors}
        isDark={isDark}
      />
      <TodoSheet
        open={showTodo}
        onClose={() => { setShowTodo(false); setEditingTodo(null); }}
        onSave={saveTodo}
        onUpdate={updateTodo}
        editTodo={editingTodo}
        colors={colors}
        accent={section.accent}
        isDark={isDark}
      />
    </div>
  );
}
