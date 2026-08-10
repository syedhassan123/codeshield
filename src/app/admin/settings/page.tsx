import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function Toggle({ label, defaultChecked = true }: { label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center justify-between py-3 border-b border-border last:border-0 text-sm">
      <span>{label}</span>
      <input type="checkbox" defaultChecked={defaultChecked} className="accent-[var(--primary)] w-4 h-4" />
    </label>
  );
}

export default function AdminSettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Platform-wide configuration and preferences."
      />

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card-soft p-5 space-y-4">
          <h3 className="font-display font-bold">Organization</h3>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Name</label>
            <Input className="mt-1.5" defaultValue="CodeShield Academy" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Domain</label>
            <Input className="mt-1.5" defaultValue="codeshield.edu" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Contact</label>
            <Input className="mt-1.5" defaultValue="admin@codeshield.ai" />
          </div>
        </div>

        <div className="card-soft p-5">
          <h3 className="font-display font-bold mb-2">Security & Proctoring</h3>
          <Toggle label="Enforce face verification" />
          <Toggle label="Block tab switching" />
          <Toggle label="Disable copy / paste" />
          <Toggle label="Detect dev tools" />
          <Toggle label="Auto-submit after 3 violations" />
          <Toggle label="Allow paste in coding test" defaultChecked={false} />
        </div>

        <div className="card-soft p-5">
          <h3 className="font-display font-bold mb-2">Notifications</h3>
          <Toggle label="Email alerts" />
          <Toggle label="SMS alerts" defaultChecked={false} />
          <Toggle label="Webhook integrations" defaultChecked={false} />
          <Toggle label="Slack notifications" />
        </div>

        <div className="card-soft p-5 space-y-4">
          <h3 className="font-display font-bold">Branding</h3>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Primary color</label>
            <Input className="mt-1.5" type="color" defaultValue="#4f55f3" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Default language</label>
            <select className="mt-1.5 w-full h-11 rounded-xl border border-border bg-card px-3 text-sm">
              <option>English</option>
              <option>Hindi</option>
              <option>Spanish</option>
              <option>French</option>
            </select>
          </div>
          <Button>Save settings</Button>
        </div>
      </div>
    </div>
  );
}
