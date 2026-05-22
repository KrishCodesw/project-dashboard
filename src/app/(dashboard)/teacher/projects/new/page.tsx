"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTags } from "@/hooks/useProjects";
import { createProject } from "@/server/actions/projects";
import { toast } from "sonner";

const DEPARTMENTS = [
  "B.E. Computer Engineering",
  "B.E. Information Technology",
  "B.E. Electronics & Tele-Communication",
  "B.E - Electronics and Computer Science",
  "B.E - Mechanical Engineering",
  "B.E. Civil Engineering",
  "B.E. Computer Science and Engineering (Cyber Security)",
  "B.E. Mechanical and Mechatronics Engineering (Additive Manufacturing)",
  "B.Tech – Artificial Intelligence & Machine Learning",
  "B.Tech – Artificial Intelligence & Data Science",
  "B.Tech – Internet of Things (IoT)",
  "B.Tech – Computer Science & Engineering (CSE-IOT)",
] as const;

// Default Domains (Used for Computer Engineering and as a fallback)
const CE_DOMAINS = [
  "Communication Networking and Web Engineering",
  "Computing and System Design",
  "Intelligent System Design and Development",
  "Multimedia Design and Development",
  "Software Development & Information System Management",
];

const DEPARTMENT_DOMAINS: Record<string, string[]> = {
  "B.E. Computer Engineering": CE_DOMAINS,
  "B.E. Computer Science and Engineering (Cyber Security)": CE_DOMAINS, // Fallback
  "B.Tech – Computer Science & Engineering (CSE-IOT)": CE_DOMAINS, // Fallback
  "B.E - Mechanical Engineering": [
    "Manufacturing",
    "Thermal Design",
    "Automation",
  ],
  "B.E. Civil Engineering": [
    "Construction Management",
    "Environment Engineering",
    "Geotechnical Engineering",
    "Structural Engineering",
    "Transportation Engineering",
    "Water Resource Engineering",
  ],
  "B.E. Information Technology": [
    "Information and communication Technology",
    "Software Product Development",
    "Artificial Intellignece & Machine Learning",
    "Web Technology and Ecommerce",
    "Database Technology",
  ],
  "B.Tech – Artificial Intelligence & Machine Learning": [
    "Health Care",
    "Agritech",
    "Security",
    "Gaming",
    "Social Benefits",
  ],
  "B.Tech – Internet of Things (IoT)": [
    "Embedded System & Hardware Design",
    "IoT Networking & Communication Technologies",
    "IoT Security & Privacy",
    "Data Management and Analytics",
    "IoT Application & Integration",
  ],
  "B.Tech – Artificial Intelligence & Data Science": [
    "AgriTech",
    "Education Entertainment & Hospitality",
    "Life Science & Pharmaceuticals",
    "Manufacturing, Retail and E-commerce",
    "FinTech",
  ],
  "B.E. Mechanical and Mechatronics Engineering (Additive Manufacturing)": [
    "Automation",
    "Advanced Manufacturing",
    "Electro Mechanical",
    "Mechanical Design",
  ],
  "B.E - Electronics and Computer Science": [
    "Digital Systems and Communication",
    "Embedded Systems and IoT",
    "Software Engineering and Systems",
    "Intelligent Systems and Data Science",
    "Cybersecurity and Networking",
  ],
  "B.E. Electronics & Tele-Communication": [
    "Advance Communication",
    "Signal Processing",
    "EDM",
    "Embedded/IoT",
    "IT",
  ],
};

const projectSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  domain: z.string().min(1, "Please select a domain"),
  department: z.enum(DEPARTMENTS, {
    required_error: "Please select a department",
  }),
  // Regex matches formats like TE-COMPA-1 or TE-COMP-A-1
  groupNo: z
    .string()
    .regex(
      /^[a-zA-Z]{2}-[a-zA-Z]+(?:-[a-zA-Z]+)?-\d+$/,
      "Format must be YEAR-DEPT-DIV-GROUP (e.g., TE-COMPA-1)",
    ),
  isRblProject: z.boolean().default(false),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  maxGroupSize: z.coerce.number().min(1).max(10),
  tagIds: z.array(z.string()).optional(),
});

type ProjectForm = z.infer<typeof projectSchema>;

const steps = ["Details", "Timeline", "Tags"];

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: tags } = useTags();

  const {
    register,
    handleSubmit,
    trigger,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      maxGroupSize: 4,
      isRblProject: false,
      domain: "",
    },
  });

  // Watch the selected department to update available domains dynamically
  const selectedDepartment = watch("department");

  // Resolve domains: Fallback to CE_DOMAINS if specific department mapping doesn't exist
  const availableDomains = selectedDepartment
    ? DEPARTMENT_DOMAINS[selectedDepartment] || CE_DOMAINS
    : [];

  async function goNext() {
    if (step === 0) {
      const valid = await trigger([
        "title",
        "description",
        "department",
        "domain",
        "groupNo",
        "maxGroupSize",
      ]);
      if (!valid) return;
    }
    if (step === 1) {
      const valid = await trigger(["startDate", "endDate"]);
      if (!valid) return;
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  async function onSubmit(data: ProjectForm) {
    setIsSubmitting(true);
    try {
      await createProject({ ...data, tagIds: selectedTags });
      toast.success("Project created successfully");
      router.push("/teacher/projects");
    } catch {
      toast.error("Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleTag(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Create New Project</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Set up a new academic project for your students
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-3">
        {steps.map((label, i) => (
          <React.Fragment key={label}>
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  i < step
                    ? "bg-primary text-primary-foreground"
                    : i === step
                      ? "bg-primary/20 text-primary border-2 border-primary"
                      : "bg-secondary text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`text-sm font-medium ${
                  i <= step ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-px ${
                  i < step ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="step-0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="title">Project Title</Label>
                <Input
                  id="title"
                  {...register("title")}
                  placeholder="e.g., AI Chatbot for Campus"
                />
                {errors.title && (
                  <p className="text-sm text-destructive">
                    {errors.title.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register("description")}
                  placeholder="Describe the project objectives, deliverables..."
                  rows={4}
                />
                {errors.description && (
                  <p className="text-sm text-destructive">
                    {errors.description.message}
                  </p>
                )}
              </div>

              {/* Shadcn UI Select Components */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Department Select - Moved to Top/Left */}
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Controller
                    name="department"
                    control={control}
                    render={({ field }) => (
                      <Select
                        onValueChange={(val) => {
                          field.onChange(val);
                          // Reset domain selection when department changes
                          setValue("domain", "", { shouldValidate: true });
                        }}
                        value={field.value}
                      >
                        <SelectTrigger id="department">
                          <SelectValue placeholder="Select Department..." />
                        </SelectTrigger>
                        <SelectContent>
                          {DEPARTMENTS.map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.department && (
                    <p className="text-sm text-destructive">
                      {errors.department.message}
                    </p>
                  )}
                </div>

                {/* Domain Select - Dependent on Department */}
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain</Label>
                  <Controller
                    name="domain"
                    control={control}
                    render={({ field }) => (
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!selectedDepartment}
                      >
                        <SelectTrigger id="domain">
                          <SelectValue
                            placeholder={
                              selectedDepartment
                                ? "Select Domain..."
                                : "Select Department First"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {availableDomains.map((domain) => (
                            <SelectItem key={domain} value={domain}>
                              {domain}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.domain && (
                    <p className="text-sm text-destructive">
                      {errors.domain.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Group Number & Max Group Size */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="groupNo">Group Number</Label>
                  <Input
                    id="groupNo"
                    {...register("groupNo", {
                      onChange: (e) => {
                        e.target.value = e.target.value.toUpperCase();
                      },
                    })}
                    placeholder="e.g., TE-COMPA-1"
                  />
                  {errors.groupNo && (
                    <p className="text-sm text-destructive">
                      {errors.groupNo.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxGroupSize">Max Group Size</Label>
                  <Input
                    id="maxGroupSize"
                    type="number"
                    {...register("maxGroupSize")}
                    min={1}
                    max={10}
                  />
                  {errors.maxGroupSize && (
                    <p className="text-sm text-destructive">
                      {errors.maxGroupSize.message}
                    </p>
                  )}
                </div>
              </div>

              {/* RBL Project Toggle */}
              <div className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                <Controller
                  name="isRblProject"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="isRblProject"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <div className="space-y-1 leading-none">
                  <Label htmlFor="isRblProject" className="cursor-pointer">
                    Mark as RBL Project
                  </Label>
                  <p className="text-sm text-muted-foreground"></p>
                </div>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    {...register("startDate")}
                  />
                  {errors.startDate && (
                    <p className="text-sm text-destructive">
                      {errors.startDate.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input id="endDate" type="date" {...register("endDate")} />
                  {errors.endDate && (
                    <p className="text-sm text-destructive">
                      {errors.endDate.message}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <Label>Tags (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {(tags ?? []).map((tag: any) => (
                  <Badge
                    key={tag.id}
                    variant={
                      selectedTags.includes(tag.id) ? "default" : "outline"
                    }
                    className="cursor-pointer transition-colors"
                    style={
                      selectedTags.includes(tag.id)
                        ? { backgroundColor: tag.color, borderColor: tag.color }
                        : { borderColor: tag.color, color: tag.color }
                    }
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                  </Badge>
                ))}
                {(tags ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No tags available
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => Math.max(s - 1, 0))}
            disabled={step === 0}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {step < steps.length - 1 ? (
            <Button type="button" onClick={goNext}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Project"
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
