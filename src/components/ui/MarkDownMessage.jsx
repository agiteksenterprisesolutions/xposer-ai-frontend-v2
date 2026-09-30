import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const MarkdownMessage = ({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="leading-relaxed [&:not(:last-child)]:mb-2">{children}</p>
        ),
        a: ({ children, ...props }) => (
          <a
            className="text-link underline underline-offset-2 hover:text-link-hover"
            target="_blank"
            rel="noopener noreferrer"
            {...props}
          >
            {children}
          </a>
        ),
        ul: ({ children }) => (
          <ul className="list-disc ml-5 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal ml-5 space-y-1">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-ink">{children}</strong>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-line-accent pl-3 my-2 text-ink-muted italic">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto scrollbar-thin my-2 rounded-lg border border-line">
            <table className="w-full border-collapse text-sm">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="bg-subtle border-b border-line px-2.5 py-1.5 text-left text-xs font-semibold text-ink-muted">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border-b border-line-subtle px-2.5 py-1.5">
            {children}
          </td>
        ),
        code: ({ inline, children }) =>
          inline ? (
            <code className="bg-active text-accent-fg font-mono px-1.5 py-0.5 rounded text-[0.85em]">
              {children}
            </code>
          ) : (
            <pre className="bg-sunken border border-line text-ink p-3 rounded-lg overflow-x-auto scrollbar-thin text-sm my-2">
              <code className="font-mono">{children}</code>
            </pre>
          ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

export default MarkdownMessage;
