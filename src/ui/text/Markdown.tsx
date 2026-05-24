import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "./Link";
import { InlineCode } from "./InlineCode";
import { CodeBlock } from "./CodeBlock";
import { Heading } from "./Heading";

type Props = { source: string; className?: string };

const components: Components = {
  a: ({ href, children }) => <Link href={href ?? "#"}>{children}</Link>,
  img: ({ alt }) => <span className="italic text-subtext">[image: {alt || "untitled"}]</span>,
  code: ({ className, children }) => {
    const text = String(children).replace(/\n$/, "");
    const match = /language-(\w+)/.exec(className ?? "");
    if (!match) return <InlineCode>{text}</InlineCode>;
    return <CodeBlock language={match[1]} code={text} />;
  },
  h1: ({ children }) => <Heading level={1}>{children}</Heading>,
  h2: ({ children }) => <Heading level={2}>{children}</Heading>,
  h3: ({ children }) => <Heading level={3}>{children}</Heading>,
  h4: ({ children }) => <Heading level={4}>{children}</Heading>,
};

export function Markdown({ source, className = "" }: Props) {
  return (
    <div className={`text-sm text-text leading-relaxed [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
