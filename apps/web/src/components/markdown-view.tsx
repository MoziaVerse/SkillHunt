import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Strip YAML frontmatter before passing to react-markdown — the SKILL.md files
// start with `---\n...\n---` which react-markdown would otherwise render as a <hr>.
function stripFrontmatter(source: string): string {
  const lines = source.split('\n');
  if (lines[0] !== '---') return source;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      return lines.slice(i + 1).join('\n');
    }
  }
  return source;
}

export function MarkdownView({ source }: { source: string }) {
  const body = stripFrontmatter(source);
  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children, ...rest }) => {
            // Try to pull the language from the nested <code class="language-xxx">
            let lang = '';
            if (
              children &&
              typeof children === 'object' &&
              'props' in children &&
              typeof (children as { props?: unknown }).props === 'object'
            ) {
              const p = (children as { props: { className?: string } }).props;
              const m = p?.className?.match(/language-([\w-]+)/);
              if (m) lang = m[1] ?? '';
            }
            return (
              <pre data-lang={lang} {...rest}>
                {children}
              </pre>
            );
          },
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
