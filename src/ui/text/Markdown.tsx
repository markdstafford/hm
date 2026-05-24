import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "./Link";
import { InlineCode } from "./InlineCode";
import { CodeBlock } from "./CodeBlock";
import { Heading } from "./Heading";

type Props = { source: string; className?: string };

export function Markdown({ source, className = "" }: Props) {
  return (
    <div className={`text-sm text-text leading-relaxed [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            return <Link href={href ?? "#"}>{children}</Link>;
          },
          img({ alt }) {
            return <span className="italic text-subtext">[image: {alt || "untitled"}]</span>;
          },
          code({ className, children, ...props }: any) {
            const code = String(children).replace(/\n$/, "");
            const inline = !(props.node?.position?.start?.line !== props.node?.position?.end?.line) && !/\n/.test(code) && !/language-/.test(className || "");
            if (inline) return <InlineCode>{code}</InlineCode>;
            const language = /language-(\w+)/.exec(className || "")?.[1] ?? "text";
            return <CodeBlock language={language} code={code} />;
          },
          h1({ children }) { return <Heading level={1}>{children}</Heading>; },
          h2({ children }) { return <Heading level={2}>{children}</Heading>; },
          h3({ children }) { return <Heading level={3}>{children}</Heading>; },
          h4({ children }) { return <Heading level={4}>{children}</Heading>; },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
