import { useEffect, useState } from 'react';
import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';
import { PORTAL } from '../config/app';

// Same look as the public page (PublicPage.jsx / PlatformPage.jsx), so what you
// type is what visitors see. Uses gray/indigo/white classes, which index.css
// re-maps in dark mode.
const CONTENT = [
  'min-h-[320px] max-h-[65vh] overflow-y-auto px-5 py-4 text-sm text-gray-700 leading-7 focus:outline-none',
  '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-gray-900 [&_h1]:mt-6 [&_h1]:mb-3',
  '[&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-6 [&_h2]:mb-2',
  '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:mt-5 [&_h3]:mb-2',
  '[&_p]:my-3 [&_a]:text-indigo-600 [&_a]:underline [&_strong]:text-gray-900',
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3 [&_li]:my-1 [&_li>p]:my-0',
  '[&_blockquote]:border-l-4 [&_blockquote]:border-indigo-200 [&_blockquote]:pl-4 [&_blockquote]:italic',
  '[&_hr]:my-6 [&_hr]:border-gray-200 [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded',
  '[&_img]:block [&_img]:mx-auto [&_img]:rounded-xl [&_img]:my-4 [&_img]:max-w-full [&_img]:h-auto [&_img.ProseMirror-selectednode]:ring-2 [&_img.ProseMirror-selectednode]:ring-indigo-500',
  '[&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_td]:border [&_th]:border [&_td]:border-gray-200 [&_th]:border-gray-200',
  '[&_td]:p-2 [&_th]:p-2 [&_th]:bg-gray-50 [&_th]:text-left [&_th]:font-semibold [&_th]:text-gray-900 [&_td>p]:my-0 [&_th>p]:my-0 [&_td]:align-top',
  '[&_.selectedCell]:bg-indigo-50',
  '[&>*:first-child]:mt-0',
].join(' ');

const Svg = ({ d }) => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const ICONS = {
  bullet: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  ordered: 'M10 6h10M10 12h10M10 18h10M4 4v4M3 8h2M3 14h2l-2 3h2',
  quote: 'M7 8h4v4H8a1 1 0 00-1 1v3M14 8h4v4h-3a1 1 0 00-1 1v3',
  link: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  left: 'M4 6h16M4 10h10M4 14h16M4 18h10',
  center: 'M4 6h16M7 10h10M4 14h16M7 18h10',
  right: 'M4 6h16M10 10h10M4 14h16M10 18h10',
  hr: 'M4 12h16',
  table: 'M3 10h18M3 14h18M10 4v16M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  image: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  undo: 'M3 10h10a5 5 0 010 10H9M3 10l4-4M3 10l4 4',
  redo: 'M21 10H11a5 5 0 000 10h4M21 10l-4-4M21 10l-4 4',
};

function Btn({ onClick, active, disabled, title, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}   // keep the text selection
      onClick={onClick}
      className={`h-8 min-w-7 px-1.5 inline-flex items-center justify-center rounded-md text-sm transition-colors disabled:opacity-40 ${
        active ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="w-px h-5 bg-gray-200 mx-0.5" />;

// Media Library picker (images only). Calls onPick(media) with the chosen item.
function ImagePicker({ onPick, onClose }) {
  const [images, setImages] = useState(null);

  useEffect(() => {
    api.get('/cms/media', { params: { media_type: 'image', per_page: 100 } })
      .then(({ data }) => setImages(data.data ?? data))
      .catch(() => { setImages([]); toast.error('Could not load the Media Library.'); });
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Insert image</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>
        <div className="p-5 overflow-y-auto">
          {images === null ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : images.length === 0 ? (
            <p className="text-sm text-gray-500">
              No images yet. Upload one in the{' '}
              <Link to={`${PORTAL}/cms/media`} target="_blank" className="text-indigo-600 font-medium">Media Library</Link>, then come back.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {images.map((m) => (
                <button type="button" key={m.id} title={m.original_name} onClick={() => onPick(m)}
                  className="aspect-square rounded-lg border-2 border-gray-200 overflow-hidden bg-gray-50 hover:border-indigo-500">
                  <img src={m.public_url} alt={m.alt_text || m.original_name} className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Image width presets (pixels). Full width = no width attribute.
const IMAGE_SIZES = [
  { label: 'Small', width: 240 },
  { label: 'Medium', width: 480 },
  { label: 'Large', width: 720 },
  { label: 'Full width', width: null },
];

// Tiptap returns <p></p> for an empty editor; store '' instead.
const clean = (html) => (html === '<p></p>' ? '' : html);

/**
 * Rich text editor for CMS content. Value in, HTML out:
 *   <RichTextEditor value={form.content} onChange={(html) => ...} invalid={!!errors.content} />
 */
export default function RichTextEditor({ value, onChange, invalid = false }) {
  const [mode, setMode] = useState('visual');     // 'visual' | 'html'
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [pickImage, setPickImage] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        trailingNode: false,          // no extra empty paragraph at the end
        // Plain links (no target/rel), so internal links like "programs" stay relative.
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https', HTMLAttributes: { target: null, rel: null } },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({ allowBase64: false }),   // images come from the Media Library only
      TableKit.configure({ table: { resizable: false } }),
    ],
    content: value || '',
    editorProps: { attributes: { class: CONTENT } },
    onUpdate: ({ editor }) => onChange(clean(editor.getHTML())),
  });

  // Keep the editor in step when the value changes from outside (page loaded, HTML view edited).
  useEffect(() => {
    if (editor && mode === 'visual' && clean(editor.getHTML()) !== (value || '')) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [editor, value, mode]);

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => e ? {
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
      image: e.isActive('image'),
      table: e.isActive('table'),
      imageWidth: e.isActive('image') ? (e.getAttributes('image').width ?? null) : null,
      imageAlt: e.isActive('image') ? (e.getAttributes('image').alt ?? '') : '',
      center: e.isActive({ textAlign: 'center' }),
      right: e.isActive({ textAlign: 'right' }),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    } : {},
  }) ?? {};

  if (!editor) return null;
  const chain = () => editor.chain().focus();

  const openLink = () => {
    setLinkUrl(editor.getAttributes('link').href ?? '');
    setLinkOpen(true);
  };
  const applyLink = () => {
    const url = linkUrl.trim();
    if (url) chain().extendMarkRange('link').setLink({ href: url }).run();
    else chain().extendMarkRange('link').unsetLink().run();
    setLinkOpen(false);
  };
  const removeLink = () => {
    chain().extendMarkRange('link').unsetLink().run();
    setLinkOpen(false);
  };

  const visual = mode === 'visual';

  return (
    <div className={`border rounded-lg bg-white overflow-hidden focus-within:ring-2 ${
      invalid ? 'border-red-400 focus-within:ring-red-400' : 'border-gray-300 focus-within:ring-indigo-500'
    }`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50">
        {visual && (
          <>
            <Btn title="Heading" active={s.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}><span className="font-bold">H2</span></Btn>
            <Btn title="Sub-heading" active={s.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()}><span className="font-semibold">H3</span></Btn>
            <Sep />
            <Btn title="Bold (Ctrl+B)" active={s.bold} onClick={() => chain().toggleBold().run()}><span className="font-bold">B</span></Btn>
            <Btn title="Italic (Ctrl+I)" active={s.italic} onClick={() => chain().toggleItalic().run()}><span className="italic font-serif">I</span></Btn>
            <Btn title="Underline (Ctrl+U)" active={s.underline} onClick={() => chain().toggleUnderline().run()}><span className="underline">U</span></Btn>
            <Btn title="Strikethrough" active={s.strike} onClick={() => chain().toggleStrike().run()}><span className="line-through">S</span></Btn>
            <Sep />
            <Btn title="Bullet list" active={s.bullet} onClick={() => chain().toggleBulletList().run()}><Svg d={ICONS.bullet} /></Btn>
            <Btn title="Numbered list" active={s.ordered} onClick={() => chain().toggleOrderedList().run()}><Svg d={ICONS.ordered} /></Btn>
            <Btn title="Quote" active={s.quote} onClick={() => chain().toggleBlockquote().run()}><Svg d={ICONS.quote} /></Btn>
            <Btn title="Divider line" onClick={() => chain().setHorizontalRule().run()}><Svg d={ICONS.hr} /></Btn>
            <Sep />
            <Btn title="Align left" active={!s.center && !s.right} onClick={() => chain().setTextAlign('left').run()}><Svg d={ICONS.left} /></Btn>
            <Btn title="Align centre" active={s.center} onClick={() => chain().setTextAlign('center').run()}><Svg d={ICONS.center} /></Btn>
            <Btn title="Align right" active={s.right} onClick={() => chain().setTextAlign('right').run()}><Svg d={ICONS.right} /></Btn>
            <Sep />
            <Btn title="Link" active={s.link || linkOpen} onClick={openLink}><Svg d={ICONS.link} /></Btn>
            <Btn title="Insert image from the Media Library" onClick={() => setPickImage(true)}><Svg d={ICONS.image} /></Btn>
            <Btn title="Insert table" active={s.table}
              onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Svg d={ICONS.table} /></Btn>
            <Sep />
            <Btn title="Undo (Ctrl+Z)" disabled={!s.canUndo} onClick={() => chain().undo().run()}><Svg d={ICONS.undo} /></Btn>
            <Btn title="Redo (Ctrl+Y)" disabled={!s.canRedo} onClick={() => chain().redo().run()}><Svg d={ICONS.redo} /></Btn>
          </>
        )}
        <div className="ml-auto">
          <Btn title={visual ? 'Edit the HTML code' : 'Back to the visual editor'} active={!visual}
            onClick={() => { setLinkOpen(false); setMode(visual ? 'html' : 'visual'); }}>
            <span className="text-xs font-mono">{visual ? '</> HTML' : '← Visual'}</span>
          </Btn>
        </div>
      </div>

      {/* Link bar */}
      {visual && linkOpen && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50">
          <input
            autoFocus
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
              if (e.key === 'Escape') setLinkOpen(false);
            }}
            placeholder="https://example.com, or a page on this site like programs"
            className="flex-1 min-w-[220px] px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button type="button" onClick={applyLink}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700">Apply</button>
          {s.link && (
            <button type="button" onClick={removeLink}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-100">Remove link</button>
          )}
          <button type="button" onClick={() => setLinkOpen(false)}
            className="px-2 py-1.5 text-sm text-gray-500 hover:underline">Cancel</button>
        </div>
      )}

      {/* Image bar: shown while an image is selected */}
      {visual && s.image && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50 text-sm">
          <span className="text-gray-500">Size:</span>
          {IMAGE_SIZES.map((sz) => (
            <Btn key={sz.label} title={sz.label} active={Number(s.imageWidth || 0) === Number(sz.width || 0)}
              onClick={() => chain().updateAttributes('image', { width: sz.width, height: null }).run()}>
              <span className="text-xs">{sz.label}</span>
            </Btn>
          ))}
          <input
            type="text"
            value={s.imageAlt}
            onChange={(e) => editor.chain().updateAttributes('image', { alt: e.target.value }).run()}
            placeholder="Alt text: describe the image"
            title="Alt text is read aloud by screen readers and shown if the image cannot load"
            className="flex-1 min-w-[140px] max-w-xs px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button type="button" onClick={() => chain().deleteSelection().run()}
            className="ml-auto px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md">Remove</button>
        </div>
      )}

      {/* Table bar: shown while the cursor is inside a table */}
      {visual && s.table && (
        <div className="flex flex-wrap items-center gap-1 px-3 py-1.5 border-b border-gray-200 bg-gray-50 text-sm">
          <span className="text-gray-500 mr-1">Table:</span>
          <Btn title="Add row below" onClick={() => chain().addRowAfter().run()}><span className="text-xs">+ Row</span></Btn>
          <Btn title="Add column to the right" onClick={() => chain().addColumnAfter().run()}><span className="text-xs">+ Column</span></Btn>
          <Btn title="Delete this row" onClick={() => chain().deleteRow().run()}><span className="text-xs">− Row</span></Btn>
          <Btn title="Delete this column" onClick={() => chain().deleteColumn().run()}><span className="text-xs">− Column</span></Btn>
          <Btn title="Turn the header row on or off" onClick={() => chain().toggleHeaderRow().run()}><span className="text-xs">Header row</span></Btn>
          <button type="button" onClick={() => chain().deleteTable().run()}
            className="ml-auto px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md">Delete table</button>
        </div>
      )}

      {pickImage && (
        <ImagePicker
          onClose={() => setPickImage(false)}
          onPick={(m) => {
            chain().setImage({ src: m.public_url, alt: m.alt_text || '', width: 480 }).run();
            setPickImage(false);
          }}
        />
      )}

      {/* Body */}
      {visual ? (
        <EditorContent editor={editor} />
      ) : (
        <textarea
          rows={16}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="block w-full px-4 py-3 font-mono text-xs leading-6 text-gray-800 bg-white focus:outline-none"
        />
      )}
    </div>
  );
}
