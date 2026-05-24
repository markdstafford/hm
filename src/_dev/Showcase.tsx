import { useState, type ReactNode } from "react";
import { Search, Inbox } from "lucide-react";
import { Heading } from "../ui/text/Heading";
import { Button } from "../ui/buttons/Button";
import { IconButton } from "../ui/buttons/IconButton";
import { TextField } from "../ui/forms/TextField";
import { Field } from "../ui/forms/Field";
import { Checkbox } from "../ui/forms/Checkbox";
import { Switch } from "../ui/forms/Switch";
import { RadioGroup } from "../ui/forms/RadioGroup";
import { Select } from "../ui/forms/Select";
import { MultiSelect } from "../ui/forms/MultiSelect";
import { Dialog } from "../ui/overlays/Dialog";
import { AlertDialog } from "../ui/overlays/AlertDialog";
import { Popover } from "../ui/overlays/Popover";
import { Tooltip } from "../ui/overlays/Tooltip";
import { DropdownMenu } from "../ui/overlays/DropdownMenu";
import { ContextMenu } from "../ui/overlays/ContextMenu";
import { Breadcrumb } from "../ui/navigation/Breadcrumb";
import { Tabs } from "../ui/navigation/Tabs";
import { KeyboardShortcut } from "../ui/navigation/KeyboardShortcut";
import { SectionLabel } from "../ui/sidebar/SectionLabel";
import { SectionDivider } from "../ui/sidebar/SectionDivider";
import { NavItem } from "../ui/sidebar/NavItem";
import { NavSection } from "../ui/sidebar/NavSection";
import { ScopeHeader } from "../ui/sidebar/ScopeHeader";
import { Toast } from "../ui/feedback/Toast";
import { EmptyState } from "../ui/feedback/EmptyState";
import { StatusDot } from "../ui/feedback/StatusDot";
import { Spinner } from "../ui/feedback/Spinner";
import { Skeleton } from "../ui/feedback/Skeleton";
import { Badge } from "../ui/data/Badge";
import { Avatar } from "../ui/data/Avatar";
import { Tag } from "../ui/data/Tag";
import { ConfidenceChip } from "../ui/data/ConfidenceChip";
import { Link } from "../ui/text/Link";
import { InlineCode } from "../ui/text/InlineCode";
import { CodeBlock } from "../ui/text/CodeBlock";
import { Markdown } from "../ui/text/Markdown";
import { Separator } from "../ui/layout/Separator";

function Card({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded border border-border bg-mantle p-3">
      <div className="text-xs text-subtext">{caption}</div>
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 mt-8">
      <Heading level={2}>{title}</Heading>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

function ColorSwatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block h-5 w-5 rounded border border-border" style={{ background: `var(${varName})` }} />
      <code className="font-mono text-xs text-subtext">{name}</code>
    </div>
  );
}

export function Showcase() {
  const [breakpointOverlay, setBreakpointOverlay] = useState(false);
  const [multi, setMulti] = useState<string[]>([]);
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Heading level={1}>Design system showcase</Heading>
      <p className="text-sm text-subtext">Press Cmd+Shift+D to toggle. Use the breakpoint overlay to inspect the 900px boundary.</p>

      <Section title="Tokens">
        <Card caption="Color tokens">
          <div className="grid grid-cols-2 gap-2 w-full">
            <ColorSwatch name="--color-background" varName="--color-background" />
            <ColorSwatch name="--color-mantle" varName="--color-mantle" />
            <ColorSwatch name="--color-surface" varName="--color-surface" />
            <ColorSwatch name="--color-primary" varName="--color-primary" />
            <ColorSwatch name="--color-text" varName="--color-text" />
            <ColorSwatch name="--color-subtext" varName="--color-subtext" />
          </div>
        </Card>
        <Card caption="Typography scale">
          <div className="flex flex-col gap-1">
            <span className="text-xs">xs — 11px</span>
            <span className="text-sm">sm — 12px</span>
            <span className="text-base">base — 13px</span>
            <span className="text-md">md — 14px</span>
            <span className="text-lg">lg — 16px</span>
          </div>
        </Card>
        <Card caption="Control heights">
          <div className="flex items-center gap-2">
            <span className="inline-block h-control-sm bg-surface w-12 rounded" />
            <span className="inline-block h-control-base bg-surface w-12 rounded" />
            <span className="inline-block h-control-lg bg-surface w-12 rounded" />
          </div>
        </Card>
        <Card caption="Breakpoint check">
          <button
            type="button"
            onClick={() => setBreakpointOverlay((v) => !v)}
            className="text-sm text-primary hover:underline"
          >
            Toggle 900px overlay
          </button>
          {breakpointOverlay && (
            <div className="fixed inset-y-0 left-[900px] w-px bg-red z-50 pointer-events-none" aria-hidden />
          )}
        </Card>
      </Section>

      <Section title="Buttons">
        <Card caption="Button variants">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button disabled>Disabled</Button>
        </Card>
        <Card caption="IconButton">
          <IconButton label="Search"><Search size={14} /></IconButton>
          <IconButton label="Active" active><Search size={14} /></IconButton>
          <IconButton label="Dimmed" dimmed><Search size={14} /></IconButton>
          <IconButton label="Disabled" disabled><Search size={14} /></IconButton>
        </Card>
      </Section>

      <Section title="Forms">
        <Card caption="TextField"><TextField aria-label="Demo" placeholder="Type…" /></Card>
        <Card caption="Field">
          <Field label="Email" help="We never share.">
            {({ id, describedBy }) => <TextField id={id} aria-describedby={describedBy} aria-label="Email" />}
          </Field>
        </Card>
        <Card caption="Checkbox"><Checkbox label="Notify me" /></Card>
        <Card caption="Switch"><Switch label="Beta features" /></Card>
        <Card caption="RadioGroup">
          <RadioGroup aria-label="Pick" defaultValue="a">
            <RadioGroup.Item value="a" label="Apple" />
            <RadioGroup.Item value="b" label="Banana" />
          </RadioGroup>
        </Card>
        <Card caption="Select">
          <Select aria-label="Pick" defaultValue="a" options={[{ value: "a", label: "Apple" }, { value: "b", label: "Banana" }]} />
        </Card>
        <Card caption="MultiSelect">
          <MultiSelect aria-label="Projects" value={multi} onChange={setMulti} options={[{ value: "p1", label: "Project 1" }, { value: "p2", label: "Project 2" }]} />
        </Card>
      </Section>

      <Section title="Overlays">
        <Card caption="Dialog">
          <Dialog.Root>
            <Dialog.Trigger asChild><Button>Open dialog</Button></Dialog.Trigger>
            <Dialog.Content>
              <Dialog.Title>Title</Dialog.Title>
              <Dialog.Description>Body content.</Dialog.Description>
              <Dialog.Close asChild><Button>Close</Button></Dialog.Close>
            </Dialog.Content>
          </Dialog.Root>
        </Card>
        <Card caption="AlertDialog">
          <AlertDialog.Root>
            <AlertDialog.Trigger asChild><Button variant="destructive">Delete</Button></AlertDialog.Trigger>
            <AlertDialog.Content>
              <AlertDialog.Title>Are you sure?</AlertDialog.Title>
              <AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
              <div className="flex gap-2 mt-4">
                <AlertDialog.Cancel asChild><Button>Cancel</Button></AlertDialog.Cancel>
                <AlertDialog.Action asChild><Button variant="destructive">Delete</Button></AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Root>
        </Card>
        <Card caption="Popover"><Popover trigger={<Button>Open popover</Button>}><div className="p-3 text-sm">Body</div></Popover></Card>
        <Card caption="Tooltip"><Tooltip content="Hello"><Button>Hover me</Button></Tooltip></Card>
        <Card caption="DropdownMenu">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild><Button>Menu</Button></DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item>One</DropdownMenu.Item>
              <DropdownMenu.Item>Two</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </Card>
        <Card caption="ContextMenu">
          <ContextMenu.Root>
            <ContextMenu.Trigger><div className="px-3 py-2 rounded border border-border text-sm">Right-click me</div></ContextMenu.Trigger>
            <ContextMenu.Content>
              <ContextMenu.Item>Copy</ContextMenu.Item>
              <ContextMenu.Item>Delete</ContextMenu.Item>
            </ContextMenu.Content>
          </ContextMenu.Root>
        </Card>
      </Section>

      <Section title="Navigation">
        <Card caption="Breadcrumb"><Breadcrumb items={[{ label: "Workspace", href: "#" }, { label: "Inbox", isCurrent: true }]} /></Card>
        <Card caption="Tabs">
          <Tabs.Root defaultValue="a">
            <Tabs.List aria-label="Sections">
              <Tabs.Trigger value="a">A</Tabs.Trigger>
              <Tabs.Trigger value="b">B</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="a">Panel A</Tabs.Content>
            <Tabs.Content value="b">Panel B</Tabs.Content>
          </Tabs.Root>
        </Card>
        <Card caption="KeyboardShortcut">
          <KeyboardShortcut binding="cmd+shift+d" />
          <KeyboardShortcut binding={["g", "i"]} />
        </Card>
      </Section>

      <Section title="Sidebar">
        <Card caption="ScopeHeader"><ScopeHeader name="Personal" /></Card>
        <Card caption="NavSection / NavItem">
          <NavSection label="Personal">
            <NavItem label="Inbox" count={0} icon={<Inbox size={12} />} active />
            <NavItem label="Drafts" count={2} />
          </NavSection>
        </Card>
        <Card caption="SectionDivider"><SectionDivider /></Card>
        <Card caption="SectionLabel"><SectionLabel>Workspace</SectionLabel></Card>
      </Section>

      <Section title="Feedback">
        <Card caption="Toast">
          <Toast.Provider>
            <Toast.Root open><Toast.Title>Saved</Toast.Title></Toast.Root>
            <Toast.Viewport />
          </Toast.Provider>
        </Card>
        <Card caption="EmptyState"><EmptyState icon={<Inbox size={20} />} title="Nothing yet" description="Come back later." /></Card>
        <Card caption="StatusDot"><StatusDot tone="green" label="Synced" /><StatusDot tone="yellow" label="Pending" /><StatusDot tone="red" label="Error" /></Card>
        <Card caption="Spinner"><Spinner label="Loading" /></Card>
        <Card caption="Skeleton"><Skeleton width={160} height={12} /></Card>
      </Section>

      <Section title="Data">
        <Card caption="Avatar"><Avatar initial="P" /><Avatar initial="A" size={28} /></Card>
        <Card caption="Badge"><Badge>New</Badge> <Badge tone="green">OK</Badge> <Badge tone="red">Fail</Badge></Card>
        <Card caption="Tag"><Tag>tagA</Tag><Tag onRemove={() => {}}>tagB</Tag></Card>
        <Card caption="ConfidenceChip"><ConfidenceChip value={92} /> <ConfidenceChip value={50} /></Card>
      </Section>

      <Section title="Text">
        <Card caption="Heading"><Heading level={3}>Heading three</Heading></Card>
        <Card caption="Link"><Link href="https://example.com">External</Link> <Link href="/inbox">Internal</Link></Card>
        <Card caption="InlineCode"><InlineCode>const x = 1</InlineCode></Card>
        <Card caption="CodeBlock"><CodeBlock language="ts" code={"const x: number = 1;"} /></Card>
        <Card caption="Markdown"><Markdown source={"## Title\n\nText with [link](https://example.com)."} /></Card>
      </Section>

      <Section title="Layout">
        <Card caption="Separator"><Separator /></Card>
        <Card caption="Separator (vertical)"><div className="flex items-center gap-2 h-6"><span>A</span><Separator orientation="vertical" /><span>B</span></div></Card>
      </Section>
    </div>
  );
}
