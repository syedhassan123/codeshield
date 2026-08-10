import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { initials } from "@/lib/utils";

const skills = [
  { name: "Python", value: 92 },
  { name: "JavaScript", value: 78 },
  { name: "SQL", value: 84 },
  { name: "System Design", value: 61 },
  { name: "Algorithms", value: 73 },
];

export default async function StudentProfilePage() {
  const session = await auth();
  const name = session?.user?.name || "Rohan Sharma";
  const email = session?.user?.email || "rohan@codeshield.edu";

  return (
    <div>
      <PageHeader
        title="My Profile"
        description="Account information and achievements."
      />

      <div className="card-soft p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-16 h-16 rounded-full gradient-primary text-white text-xl font-bold flex items-center justify-center">
            {initials(name)}
          </div>
          <div className="flex-1">
            <h2 className="font-display font-bold text-2xl">{name}</h2>
            <p className="text-sm text-muted-foreground">{email}</p>
            <p className="text-sm text-muted-foreground mt-1">
              B.Tech CSE · Year 3
            </p>
          </div>
          <Button variant="outline" size="sm">
            Edit Profile
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Assessments" value="14" />
        <StatCard label="Coding" value="42" />
        <StatCard label="Interviews" value="3" />
        <StatCard label="Certificates" value="5" />
      </div>

      <div className="card-soft p-5">
        <h3 className="font-display font-bold mb-4">Skills</h3>
        <div className="space-y-4">
          {skills.map((s) => (
            <div key={s.name}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-semibold">{s.name}</span>
                <span className="text-muted-foreground">{s.value} %</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full gradient-primary"
                  style={{ width: `${s.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
