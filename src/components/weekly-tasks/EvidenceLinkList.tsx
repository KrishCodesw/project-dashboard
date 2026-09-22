import React from "react";
import { ExternalLink, Github, Folder, Layout, FileText } from "lucide-react";
import { EvidenceItem } from "@/types/weekly-task";

const iconMap = {
  GITHUB: Github,
  DRIVE: Folder,
  DESIGN: Layout,
  DOCUMENT: FileText,
};

export function EvidenceLinkList({ links }: { links: EvidenceItem[] }) {
  if (!links || links.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">No evidence attached yet.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {links.map((link, index) => {
        const Icon = iconMap[link.type] || ExternalLink;
        return (
          <li key={link.id || index}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
            >
              <Icon className="w-4 h-4 text-gray-600" />
              <span>{link.title}</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
