import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Building,
  Mail,
  Link2,
  Clock,
  Users,
  Calculator,
  Megaphone,
  UserCheck,
  UserCircle,
  Pencil,
  Check,
  X,
  Bell,
} from "lucide-react";
import { usePushSubscription } from "@/hooks/usePushSubscription";

type Profile = {
  id: string;
  business_name: string | null;
  email: string | null;
  timezone: string | null;
};

type Validator = {
  id: string;
  agent_type: string;
  validator_name: string;
  validator_email: string;
  validator_position: string | null;
  is_self: boolean;
};

const timezones = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Kolkata", label: "Mumbai (IST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
  { value: "Africa/Nairobi", label: "Nairobi (EAT)" },
  { value: "Africa/Lagos", label: "Lagos (WAT)" },
  { value: "Africa/Johannesburg", label: "Johannesburg (SAST)" },
];

const agentConfig = [
  {
    type: "personal_assistant",
    label: "Personal Assistant",
    icon: UserCircle,
    color: "text-sky-500",
    bgColor: "bg-sky-500/10",
  },
  {
    type: "accountant",
    label: "Accountant",
    icon: Calculator,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    type: "marketer",
    label: "Marketer",
    icon: Megaphone,
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
  },
  {
    type: "sales_rep",
    label: "Sales Rep",
    icon: UserCheck,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
];

export function SettingsPage() {
  const { token, userId } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validators, setValidators] = useState<Validator[]>([]);
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [validatorForm, setValidatorForm] = useState({
    validator_name: "",
    validator_email: "",
    validator_position: "",
    is_self: true,
  });
  const [savingValidator, setSavingValidator] = useState(false);
  const { toast } = useToast();

  const {
    isSubscribed,
    isLoading: pushLoading,
    subscribe,
    unsubscribe,
  } = usePushSubscription(userId);

  const [formData, setFormData] = useState({
    business_name: "",
    timezone: "America/New_York",
  });

  useEffect(() => {
    if (!token) return;
    fetchProfile();
    fetchValidators();
  }, [token]);

  const fetchProfile = async () => {
    try {
      const data = await api.get<Profile>("/api/profiles/me", { token: token! });
      if (data) {
        setProfile(data);
        setFormData({
          business_name: data.business_name || "",
          timezone: data.timezone || "America/New_York",
        });
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchValidators = async () => {
    try {
      const data = await api.get<Validator[]>("/api/agent-validators", { token: token! });
      if (data) {
        setValidators(data);
      }
    } catch (err) {
      console.error("Error fetching validators:", err);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);

    try {
      await api.patch("/api/profiles/me", {
        business_name: formData.business_name,
        timezone: formData.timezone,
      }, { token: token! });
      toast({ title: "Success", description: "Settings saved" });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const startEditingValidator = (agentType: string) => {
    const existing = validators.find((v) => v.agent_type === agentType);
    if (existing) {
      setValidatorForm({
        validator_name: existing.validator_name,
        validator_email: existing.validator_email,
        validator_position: existing.validator_position || "",
        is_self: existing.is_self,
      });
    } else {
      setValidatorForm({
        validator_name: "",
        validator_email: profile?.email || "",
        validator_position: "",
        is_self: true,
      });
    }
    setEditingAgent(agentType);
  };

  const cancelEditing = () => {
    setEditingAgent(null);
    setValidatorForm({
      validator_name: "",
      validator_email: "",
      validator_position: "",
      is_self: true,
    });
  };

  const saveValidator = async (agentType: string) => {
    if (
      !validatorForm.validator_name.trim() ||
      !validatorForm.validator_email.trim()
    ) {
      toast({
        title: "Error",
        description: "Name and email are required",
        variant: "destructive",
      });
      return;
    }

    setSavingValidator(true);

    const existing = validators.find((v) => v.agent_type === agentType);

    try {
      if (existing) {
        await api.patch(`/api/agent-validators/${existing.id}`, {
          validator_name: validatorForm.validator_name.trim(),
          validator_email: validatorForm.validator_email.trim(),
          validator_position: validatorForm.validator_position.trim() || null,
          is_self: validatorForm.is_self,
        }, { token: token! });
        toast({ title: "Success", description: "Validator updated" });
      } else {
        await api.post("/api/agent-validators", {
          agent_type: agentType,
          validator_name: validatorForm.validator_name.trim(),
          validator_email: validatorForm.validator_email.trim(),
          validator_position: validatorForm.validator_position.trim() || null,
          is_self: validatorForm.is_self,
        }, { token: token! });
        toast({ title: "Success", description: "Validator added" });
      }
      await fetchValidators();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save validator",
        variant: "destructive",
      });
    } finally {
      setSavingValidator(false);
      setEditingAgent(null);
    }
  };

  const handleSelfToggle = (checked: boolean) => {
    if (checked && profile?.email) {
      setValidatorForm({
        ...validatorForm,
        is_self: true,
        validator_email: profile.email,
        validator_name: formData.business_name || "Me",
      });
    } else {
      setValidatorForm({
        ...validatorForm,
        is_self: false,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">Loading...</div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and integrations
        </p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Business Profile
          </CardTitle>
          <CardDescription>Your business information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Business Name</Label>
            <Input
              value={formData.business_name}
              onChange={(e) =>
                setFormData({ ...formData, business_name: e.target.value })
              }
              placeholder="Your Company"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={profile?.email || ""} disabled />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Human Validators Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Human Validators
          </CardTitle>
          <CardDescription>
            Assign team members to review and approve outputs from each AI agent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {agentConfig.map((agent) => {
            const AgentIcon = agent.icon;
            const validator = validators.find(
              (v) => v.agent_type === agent.type,
            );
            const isEditing = editingAgent === agent.type;

            return (
              <div key={agent.type} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${agent.bgColor}`}>
                      <AgentIcon className={`h-4 w-4 ${agent.color}`} />
                    </div>
                    <div>
                      <p className="font-medium">AI {agent.label}</p>
                      {!isEditing && (
                        <p className="text-sm text-muted-foreground">
                          {validator
                            ? `${validator.validator_name} (${validator.validator_email})`
                            : "No validator assigned"}
                        </p>
                      )}
                    </div>
                  </div>
                  {!isEditing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditingValidator(agent.type)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {isEditing && (
                  <div className="space-y-3 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">I am the validator</Label>
                      <Switch
                        checked={validatorForm.is_self}
                        onCheckedChange={handleSelfToggle}
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={validatorForm.validator_name}
                          onChange={(e) =>
                            setValidatorForm({
                              ...validatorForm,
                              validator_name: e.target.value,
                            })
                          }
                          placeholder="Validator name"
                          disabled={validatorForm.is_self}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Email</Label>
                        <Input
                          type="email"
                          value={validatorForm.validator_email}
                          onChange={(e) =>
                            setValidatorForm({
                              ...validatorForm,
                              validator_email: e.target.value,
                            })
                          }
                          placeholder="validator@email.com"
                          disabled={validatorForm.is_self}
                        />
                      </div>
                    </div>

                    {!validatorForm.is_self && (
                      <div className="space-y-1">
                        <Label className="text-xs">Position (optional)</Label>
                        <Input
                          value={validatorForm.validator_position}
                          onChange={(e) =>
                            setValidatorForm({
                              ...validatorForm,
                              validator_position: e.target.value,
                            })
                          }
                          placeholder="e.g., CFO, Marketing Manager"
                        />
                      </div>
                    )}

                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelEditing}
                        disabled={savingValidator}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => saveValidator(agent.type)}
                        disabled={savingValidator}
                      >
                        {savingValidator ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4 mr-1" />
                        )}
                        Save
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Timezone Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Timezone
          </CardTitle>
          <CardDescription>
            Set your timezone for scheduled tasks and daily briefings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Your Timezone</Label>
            <Select
              value={formData.timezone}
              onValueChange={(value) =>
                setFormData({ ...formData, timezone: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Your Personal Assistant will send daily briefings at 8 AM in this
              timezone
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Timezone
          </Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>Manage how you receive agent alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Enable push alerts</p>
              <p className="text-sm text-muted-foreground">
                Receive urgent agent alerts in your OS notification center
              </p>
            </div>
            <Switch
              checked={isSubscribed}
              onCheckedChange={(checked) =>
                checked ? subscribe() : unsubscribe()
              }
              disabled={pushLoading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Integrations
          </CardTitle>
          <CardDescription>Connect external services</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <Mail className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-medium">Gmail</p>
                <p className="text-sm text-muted-foreground">
                  Connect for invoice scanning & outreach
                </p>
              </div>
            </div>
            <Button variant="outline" disabled>
              Coming Soon
            </Button>
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/10">
                <svg
                  className="h-5 w-5 text-pink-600"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </div>
              <div>
                <p className="font-medium">Instagram</p>
                <p className="text-sm text-muted-foreground">
                  Post content directly
                </p>
              </div>
            </div>
            <Button variant="outline" disabled>
              Coming Soon
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
