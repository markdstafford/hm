import { useState, useEffect, useRef, type ReactNode } from "react";
import { Search, Inbox } from "lucide-react";
import {
  THEME_CATALOG,
  CATPPUCCIN_ACCENTS,
  applyColorScheme,
  applyFonts,
  getThemeMeta,
  themeSupportsFeature,
  type CatppuccinAccent,
} from "../theme";
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

function ToastDemo() {
  const [open, setOpen] = useState(false);
  return (
    <Toast.Provider duration={2500}>
      <Button onClick={() => setOpen(true)}>Show toast</Button>
      <Toast.Root open={open} onOpenChange={setOpen}>
        <Toast.Title>Saved</Toast.Title>
        <Toast.Description>Your changes are persisted.</Toast.Description>
      </Toast.Root>
      <Toast.Viewport />
    </Toast.Provider>
  );
}

export function Showcase() {
  const [breakpointOverlay, setBreakpointOverlay] = useState(false);
  const [multi, setMulti] = useState<string[]>([]);

  const initialRef = useRef<null | {
    themeId: string;
    brightness: "light" | "dark";
    accent: CatppuccinAccent | undefined;
    uiFont: string;
    monoFont: string;
  }>(null);

  if (!initialRef.current && typeof document !== "undefined") {
    const root = document.documentElement;
    const themeId = root.dataset.theme ?? "catppuccin-macchiato";
    const brightness = (root.dataset.themeMode === "light" ? "light" : "dark") as "light" | "dark";
    const accent = (root.dataset.accent as CatppuccinAccent | undefined) || undefined;
    const sansVar = root.style.getPropertyValue("--font-sans") || getComputedStyle(root).getPropertyValue("--font-sans");
    const monoVar = root.style.getPropertyValue("--font-mono") || getComputedStyle(root).getPropertyValue("--font-mono");
    const firstFamily = (s: string) => (s.match(/^["']?([^"',]+)["']?/)?.[1] ?? "").trim();
    initialRef.current = {
      themeId,
      brightness,
      accent,
      uiFont: firstFamily(sansVar) || "Inter Variable",
      monoFont: firstFamily(monoVar) || "Fira Code",
    };
  }

  const [themeId, setThemeId] = useState(() => initialRef.current?.themeId ?? "catppuccin-macchiato");
  const [accent, setAccent] = useState<CatppuccinAccent | undefined>(() => initialRef.current?.accent);
  const [uiFont, setUiFont] = useState(() => initialRef.current?.uiFont ?? "Inter Variable");
  const [monoFont, setMonoFont] = useState(() => initialRef.current?.monoFont ?? "Fira Code");

  useEffect(() => {
    const brightness = (getThemeMeta(themeId)?.brightness ?? "dark") as "light" | "dark";
    const supportsAccent = themeSupportsFeature(themeId, "catppuccinAccent");
    applyColorScheme({ themeId, brightness, accent: supportsAccent ? accent : undefined });
  }, [themeId, accent]);

  useEffect(() => {
    applyFonts(uiFont, monoFont);
  }, [uiFont, monoFont]);

  useEffect(() => {
    return () => {
      const initial = initialRef.current;
      if (!initial) return;
      applyColorScheme({ themeId: initial.themeId, brightness: initial.brightness, accent: initial.accent });
      applyFonts(initial.uiFont, initial.monoFont);
    };
  }, []);

  const supportsAccent = themeSupportsFeature(themeId, "catppuccinAccent");

  function reset() {
    const initial = initialRef.current;
    if (!initial) return;
    setThemeId(initial.themeId);
    setAccent(initial.accent);
    setUiFont(initial.uiFont);
    setMonoFont(initial.monoFont);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Heading level={1}>Design system showcase</Heading>
      <p className="text-sm text-subtext">Press Cmd+Shift+D to toggle. Use the breakpoint overlay to inspect the 900px boundary. Theme, accent, and font changes are transient; they do not write to your preferences.</p>

      <Section title="Appearance (transient)">
        <Card caption="Theme">
          <Select
            aria-label="Theme"
            value={themeId}
            onValueChange={setThemeId}
            options={THEME_CATALOG.map((t) => ({ value: t.id, label: t.label }))}
          />
        </Card>
        {supportsAccent && (
          <Card caption="Catppuccin accent">
            <Select
              aria-label="Accent"
              value={accent ?? "sapphire"}
              onValueChange={(v) => setAccent(v as CatppuccinAccent)}
              options={CATPPUCCIN_ACCENTS.map((a) => ({ value: a, label: a }))}
            />
          </Card>
        )}
        <Card caption="UI font">
          <TextField aria-label="UI font" value={uiFont} onChange={(e) => setUiFont(e.target.value)} />
        </Card>
        <Card caption="Code font">
          <TextField aria-label="Code font" value={monoFont} onChange={(e) => setMonoFont(e.target.value)} />
        </Card>
        <Card caption="Reset">
          <Button onClick={reset}>Reset to my preferences</Button>
        </Card>
      </Section>

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
        <Card caption="TextField">
          <div className="flex flex-col gap-2 w-full">
            <TextField aria-label="Demo" placeholder="Type…" />
            <TextField aria-label="Invalid demo" placeholder="Invalid" invalid defaultValue="bad input" />
          </div>
        </Card>
        <Card caption="Field">
          <Field label="Email" help="We never share.">
            {({ id, describedBy }) => <TextField id={id} aria-describedby={describedBy} aria-label="Email" />}
          </Field>
        </Card>
        <Card caption="Field with error">
          <Field label="Email" error="Looks like that's not an email">
            {({ id, describedBy }) => <TextField id={id} aria-describedby={describedBy} invalid defaultValue="not-an-email" />}
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
              <Dialog.Description>Body content describing the action the user is about to take.</Dialog.Description>
              <div className="mt-4 flex justify-end gap-2">
                <Dialog.Close asChild><Button>Cancel</Button></Dialog.Close>
                <Dialog.Close asChild><Button variant="primary">Confirm</Button></Dialog.Close>
              </div>
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
        <Card caption="Toast (auto-dismisses)">
          <ToastDemo />
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
        <Card caption="ConfidenceChip">
          <ConfidenceChip value={100} />
          <ConfidenceChip value={90} />
          <ConfidenceChip value={85} />
          <ConfidenceChip value={84} />
          <ConfidenceChip value={50} />
          <ConfidenceChip value={25} />
          <ConfidenceChip value={0} />
        </Card>
      </Section>

      <Section title="Text">
        <Card caption="Heading">
          <div className="flex flex-col gap-2 w-full">
            <Heading level={1}>Heading one</Heading>
            <Heading level={2}>Heading two</Heading>
            <Heading level={3}>Heading three</Heading>
            <Heading level={4}>Heading four</Heading>
            <Heading level={5}>Heading five</Heading>
            <Heading level={6}>Heading six</Heading>
          </div>
        </Card>
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
