"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarIcon, UploadIcon } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

import { PublicationType, IndexingType } from "@/types";
import {
  useCreatePublication,
  useUpdatePublication,
} from "@/hooks/usePublications";
import { cn } from "@/lib/utils";

const publicationFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  authors: z.array(z.string()).min(1, "At least one author is required"),
  publicationType: z.enum([
    "PAPER",
    "PATENT",
    "BOOK_CHAPTER",
    "COPYRIGHT",
    "REVIEW",
  ]),
  subType: z.string().optional(),
  journalName: z.string().optional(),
  conferenceName: z.string().optional(),
  bookTitle: z.string().optional(),
  publisher: z.string().optional(),
  doi: z.string().optional(),
  indexingType: z
    .enum(["SCOPUS", "SCI", "WEB_OF_SCIENCE", "UGC_CARE", "NONE"])
    .optional(),
  volume: z.string().optional(),
  issue: z.string().optional(),
  pages: z.string().optional(),
  publicationDate: z.date(),
  proofUrl: z.string().optional(),
  remarks: z.string().optional(),
});

type PublicationFormData = z.infer<typeof publicationFormSchema>;

interface PublicationFormProps {
  projectId: string;
  publication?: any; // For editing
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

const PUBLICATION_TYPES = [
  { value: "PAPER", label: "Research Paper" },
  { value: "PATENT", label: "Patent" },
  { value: "BOOK_CHAPTER", label: "Book Chapter" },
  { value: "COPYRIGHT", label: "Copyright" },
  { value: "REVIEW", label: "Review Article" },
] as const;

const INDEXING_TYPES = [
  { value: "SCOPUS", label: "Scopus" },
  { value: "SCI", label: "SCI" },
  { value: "WEB_OF_SCIENCE", label: "Web of Science" },
  { value: "UGC_CARE", label: "UGC CARE" },
  { value: "NONE", label: "Not Indexed" },
] as const;

const SUB_TYPES = {
  PAPER: ["Indexed", "Non-Indexed"],
  PATENT: ["Filed", "Published", "Granted"],
  BOOK_CHAPTER: [],
  COPYRIGHT: [],
  REVIEW: [],
};

export function PublicationForm({
  projectId,
  publication,
  trigger,
  onSuccess,
}: PublicationFormProps) {
  const [open, setOpen] = useState(false);
  const [authorInput, setAuthorInput] = useState("");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const createMutation = useCreatePublication();
  const updateMutation = useUpdatePublication();

  const form = useForm<PublicationFormData>({
    resolver: zodResolver(publicationFormSchema),
    defaultValues: {
      title: publication?.title || "",
      authors: publication?.authors || [],
      publicationType: publication?.publicationType || "PAPER",
      subType: publication?.subType || "",
      journalName: publication?.journalName || "",
      conferenceName: publication?.conferenceName || "",
      bookTitle: publication?.bookTitle || "",
      publisher: publication?.publisher || "",
      doi: publication?.doi || "",
      indexingType: publication?.indexingType || "NONE",
      volume: publication?.volume || "",
      issue: publication?.issue || "",
      pages: publication?.pages || "",
      publicationDate: publication?.publicationDate
        ? new Date(publication.publicationDate)
        : new Date(),
      proofUrl: publication?.proofUrl || "",
      remarks: publication?.remarks || "",
    },
  });

  const publicationType = form.watch("publicationType");
  const authors = form.watch("authors");

  const onSubmit = async (data: PublicationFormData) => {
    try {
      if (publication) {
        await updateMutation.mutateAsync({
          id: publication.id,
          ...data,
        });
      } else {
        await createMutation.mutateAsync({
          projectId,
          ...data,
        });
      }
      setOpen(false);
      form.reset();
      onSuccess?.();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const addAuthor = () => {
    if (authorInput.trim() && !authors.includes(authorInput.trim())) {
      form.setValue("authors", [...authors, authorInput.trim()]);
      setAuthorInput("");
    }
  };

  const removeAuthor = (author: string) => {
    form.setValue(
      "authors",
      authors.filter((a) => a !== author),
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addAuthor();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <UploadIcon className="w-4 h-4 mr-2" />
            Add Publication
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {publication ? "Edit Publication" : "Add New Publication"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="Publication title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Authors */}
            <div className="space-y-2">
              <Label>Authors *</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add author name"
                  value={authorInput}
                  onChange={(e) => setAuthorInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
                <Button type="button" onClick={addAuthor} variant="outline">
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {authors.map((author) => (
                  <Badge
                    key={author}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {author}
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => removeAuthor(author)}
                    />
                  </Badge>
                ))}
              </div>
              {form.formState.errors.authors && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.authors.message}
                </p>
              )}
            </div>

            {/* Publication Type */}
            <FormField
              control={form.control}
              name="publicationType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Publication Type *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select publication type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PUBLICATION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Sub Type */}
            {SUB_TYPES[publicationType as keyof typeof SUB_TYPES]?.length >
              0 && (
              <FormField
                control={form.control}
                name="subType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sub type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SUB_TYPES[
                          publicationType as keyof typeof SUB_TYPES
                        ].map((subType) => (
                          <SelectItem key={subType} value={subType}>
                            {subType}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Conditional Fields based on type */}
            {publicationType === "PAPER" && (
              <>
                <FormField
                  control={form.control}
                  name="journalName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Journal Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Journal name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="indexingType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Indexing Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select indexing type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {INDEXING_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {publicationType === "PAPER" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="volume"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Volume</FormLabel>
                        <FormControl>
                          <Input placeholder="Vol." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="issue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Issue</FormLabel>
                        <FormControl>
                          <Input placeholder="Issue" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pages"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pages</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 123-145" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            {publicationType === "BOOK_CHAPTER" && (
              <>
                <FormField
                  control={form.control}
                  name="bookTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Book Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Book title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="publisher"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Publisher</FormLabel>
                      <FormControl>
                        <Input placeholder="Publisher name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* DOI */}
            <FormField
              control={form.control}
              name="doi"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>DOI</FormLabel>
                  <FormControl>
                    <Input placeholder="10.xxxx/xxxxx" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Publication Date */}
            <FormField
              control={form.control}
              name="publicationDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Publication Date *</FormLabel>
                  {/* modal={true} ensures the Dialog doesn't block Calendar clicks */}
                  <Popover modal={true}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    {/* Added min-w-[280px] to prevent the CSS bunching bug */}
                    <PopoverContent
                      className="w-auto min-w-[280px] p-0 z-[105]"
                      align="start"
                    >
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                          if (date) field.onChange(date);
                        }}
                        disabled={(date) => date < new Date("1900-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Proof URL */}
            <FormField
              control={form.control}
              name="proofUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proof URL</FormLabel>
                  <FormControl>
                    <Input placeholder="Link to publication proof" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Remarks */}
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes or remarks"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : publication
                    ? "Update Publication"
                    : "Add Publication"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
