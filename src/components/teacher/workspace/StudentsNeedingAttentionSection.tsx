"use client";

import { Users } from "lucide-react";
import { StudentRow } from "./StudentRow";
import { EmptySectionState } from "./EmptySectionState";
import type { StudentAttentionData } from "@/lib/delivery/types";

interface StudentsNeedingAttentionSectionProps {
  students: StudentAttentionData[];
}

export function StudentsNeedingAttentionSection({
  students,
}: StudentsNeedingAttentionSectionProps) {
  if (students.length === 0) {
    return (
      <section>
        <SectionTitle count={0} />
        <EmptySectionState
          icon={Users}
          title="All students are actively working"
          description="No students currently need your attention."
        />
      </section>
    );
  }

  return (
    <section>
      <SectionTitle count={students.length} />
      <div className="space-y-2">
        {students.map((student, i) => (
          <StudentRow
            key={`${student.studentId}-${student.reason}`}
            studentId={student.studentId}
            studentName={student.studentName}
            email={student.email}
            projectId={student.projectId}
            projectTitle={student.projectTitle}
            reason={student.reason}
            detail={student.detail}
            actionLinks={student.actionLinks}
            index={i}
          />
        ))}
      </div>
    </section>
  );
}

function SectionTitle({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Users className="h-4 w-4 text-primary" />
      <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
        Students Needing Attention
      </h2>
      {count > 0 && (
        <span className="text-[11px] text-muted-foreground">({count})</span>
      )}
    </div>
  );
}
