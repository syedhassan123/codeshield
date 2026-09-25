"use client";

import { useState, useTransition } from "react";
import { saveAdminSettingsAction } from "@/lib/actions/settings";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type PlatformSettings = {
  organizationName: string;
  organizationDomain: string;
  contactEmail: string;
  security: {
    enforceFaceVerification: boolean;
    blockTabSwitching: boolean;
    disableCopyPaste: boolean;
    detectDevTools: boolean;
    autoSubmitAfterViolations: boolean;
    allowPasteInCodingTest: boolean;
  };
  notifications: {
    emailAlerts: boolean;
    smsAlerts: boolean;
    webhookIntegrations: boolean;
    slackNotifications: boolean;
  };
  branding: {
    primaryColor: string;
    defaultLanguage: string;
  };
  updatedAt: string | null;
};

function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0 text-sm cursor-pointer">
      <span>
        {label}
        {hint && (
          <span className="block text-[10px] text-muted-foreground mt-0.5">
            {hint}
          </span>
        )}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[var(--primary)] w-4 h-4 shrink-0"
      />
    </label>
  );
}

export function AdminSettingsClient({
  initialSettings,
}: {
  initialSettings: PlatformSettings;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const update = <K extends keyof PlatformSettings>(
    key: K,
    value: PlatformSettings[K],
  ) => setSettings((prev) => ({ ...prev, [key]: value }));

  const updateSecurity = (
    key: keyof PlatformSettings["security"],
    value: boolean,
  ) => update("security", { ...settings.security, [key]: value });

  const updateNotifications = (
    key: keyof PlatformSettings["notifications"],
    value: boolean,
  ) => update("notifications", { ...settings.notifications, [key]: value });

  const updateBranding = (
    key: keyof PlatformSettings["branding"],
    value: string,
  ) => update("branding", { ...settings.branding, [key]: value });

  const save = () => {
    setMessage("");
    setError("");
    startTransition(async () => {
      const result = await saveAdminSettingsAction({
        organizationName: settings.organizationName,
        organizationDomain: settings.organizationDomain,
        contactEmail: settings.contactEmail,
        security: settings.security,
        notifications: settings.notifications,
        branding: settings.branding,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("settings" in result && result.settings) {
        setSettings(result.settings);
        setMessage("Settings saved.");
      }
    });
  };

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
            <Label>Name</Label>
            <Input
              value={settings.organizationName}
              onChange={(e) => update("organizationName", e.target.value)}
            />
          </div>
          <div>
            <Label>Domain</Label>
            <Input
              value={settings.organizationDomain}
              onChange={(e) => update("organizationDomain", e.target.value)}
            />
          </div>
          <div>
            <Label>Contact</Label>
            <Input
              value={settings.contactEmail}
              onChange={(e) => update("contactEmail", e.target.value)}
            />
          </div>
        </div>

        <div className="card-soft p-5">
          <h3 className="font-display font-bold mb-2">Security & Proctoring</h3>
          <Toggle
            label="Enforce face verification"
            hint="Default for newly created assessments"
            checked={settings.security.enforceFaceVerification}
            onChange={(v) => updateSecurity("enforceFaceVerification", v)}
          />
          <Toggle
            label="Block tab switching"
            hint="Default for newly created assessments"
            checked={settings.security.blockTabSwitching}
            onChange={(v) => updateSecurity("blockTabSwitching", v)}
          />
          <Toggle
            label="Disable copy / paste"
            hint="Default for newly created assessments"
            checked={settings.security.disableCopyPaste}
            onChange={(v) => updateSecurity("disableCopyPaste", v)}
          />
          <Toggle
            label="Detect dev tools"
            hint="Stored preference — not yet enforced during exams"
            checked={settings.security.detectDevTools}
            onChange={(v) => updateSecurity("detectDevTools", v)}
          />
          <Toggle
            label="Auto-submit after 3 violations"
            hint="Stored preference — not yet enforced during exams"
            checked={settings.security.autoSubmitAfterViolations}
            onChange={(v) => updateSecurity("autoSubmitAfterViolations", v)}
          />
          <Toggle
            label="Allow paste in coding test"
            hint="Stored preference — not yet read by the coding editor"
            checked={settings.security.allowPasteInCodingTest}
            onChange={(v) => updateSecurity("allowPasteInCodingTest", v)}
          />
        </div>

        <div className="card-soft p-5">
          <h3 className="font-display font-bold mb-2">Notifications</h3>
          <p className="text-[11px] text-muted-foreground mb-1">
            Stored preferences — no delivery integration reads these yet.
          </p>
          <Toggle
            label="Email alerts"
            checked={settings.notifications.emailAlerts}
            onChange={(v) => updateNotifications("emailAlerts", v)}
          />
          <Toggle
            label="SMS alerts"
            checked={settings.notifications.smsAlerts}
            onChange={(v) => updateNotifications("smsAlerts", v)}
          />
          <Toggle
            label="Webhook integrations"
            checked={settings.notifications.webhookIntegrations}
            onChange={(v) => updateNotifications("webhookIntegrations", v)}
          />
          <Toggle
            label="Slack notifications"
            checked={settings.notifications.slackNotifications}
            onChange={(v) => updateNotifications("slackNotifications", v)}
          />
        </div>

        {/* <div className="card-soft p-5 space-y-4">
          <h3 className="font-display font-bold">Branding</h3>
          <p className="text-[11px] text-muted-foreground">
            Stored preference — not yet applied to the live UI theme.
          </p>
          <div>
            <Label>Primary color</Label>
            <Input
              type="color"
              value={settings.branding.primaryColor}
              onChange={(e) => updateBranding("primaryColor", e.target.value)}
            />
          </div>
          <div>
            <Label>Default language</Label>
            <select
              className="w-full h-11 rounded-xl border border-border bg-card px-3 text-sm"
              value={settings.branding.defaultLanguage}
              onChange={(e) => updateBranding("defaultLanguage", e.target.value)}
            >
              <option>English</option>
              <option>Hindi</option>
              <option>Spanish</option>
              <option>French</option>
            </select>
          </div>
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save settings"}
          </Button>
          {message && (
            <p className="text-sm font-medium text-success">{message}</p>
          )}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
        </div> */}
      </div>
    </div>
  );
}
