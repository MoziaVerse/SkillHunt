// Minimal, dependency-free markdown renderer — just enough for SKILL.md
// Handles: headings (#-####), fenced code blocks, inline code, bold/italic, lists, paragraphs.

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderInline(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  return out;
}

function Markdown({ source }) {
  const html = React.useMemo(() => {
    const lines = source.split('\n');
    const out = [];
    let i = 0;
    let inCode = false;
    let codeLang = '';
    let codeBuf = [];
    let listBuf = null;

    const flushList = () => {
      if (!listBuf) return;
      const tag = listBuf.type;
      out.push(
        `<${tag}>` +
          listBuf.items.map((it) => `<li>${renderInline(it)}</li>`).join('') +
          `</${tag}>`
      );
      listBuf = null;
    };

    // Strip YAML frontmatter
    if (lines[0] === '---') {
      let k = 1;
      while (k < lines.length && lines[k] !== '---') k++;
      i = k + 1;
    }

    for (; i < lines.length; i++) {
      const line = lines[i];

      if (/^```/.test(line)) {
        if (!inCode) {
          flushList();
          inCode = true;
          codeLang = line.slice(3).trim();
          codeBuf = [];
        } else {
          out.push(
            `<pre data-lang="${escapeHtml(codeLang)}"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`
          );
          inCode = false;
          codeLang = '';
          codeBuf = [];
        }
        continue;
      }
      if (inCode) {
        codeBuf.push(line);
        continue;
      }

      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        flushList();
        const level = h[1].length;
        out.push(`<h${level}>${renderInline(h[2])}</h${level}>`);
        continue;
      }

      const ul = line.match(/^[-*]\s+(.*)$/);
      if (ul) {
        if (!listBuf || listBuf.type !== 'ul') {
          flushList();
          listBuf = { type: 'ul', items: [] };
        }
        listBuf.items.push(ul[1]);
        continue;
      }
      const ol = line.match(/^\d+\.\s+(.*)$/);
      if (ol) {
        if (!listBuf || listBuf.type !== 'ol') {
          flushList();
          listBuf = { type: 'ol', items: [] };
        }
        listBuf.items.push(ol[1]);
        continue;
      }

      if (line.trim() === '') {
        flushList();
        continue;
      }

      flushList();
      let para = [line];
      while (
        i + 1 < lines.length &&
        lines[i + 1].trim() !== '' &&
        !/^(#{1,4})\s/.test(lines[i + 1]) &&
        !/^```/.test(lines[i + 1]) &&
        !/^[-*]\s+/.test(lines[i + 1]) &&
        !/^\d+\.\s+/.test(lines[i + 1])
      ) {
        i++;
        para.push(lines[i]);
      }
      out.push(`<p>${renderInline(para.join(' '))}</p>`);
    }

    flushList();
    if (inCode) {
      out.push(
        `<pre data-lang="${escapeHtml(codeLang)}"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`
      );
    }
    return out.join('\n');
  }, [source]);

  return <div className="md-body" dangerouslySetInnerHTML={{ __html: html }} />;
}

Object.assign(window, { Markdown });
