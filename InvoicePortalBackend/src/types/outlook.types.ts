export interface GraphEmailAddress {
  name?: string;
  address?: string;
}

export interface GraphRecipient {
  emailAddress?: GraphEmailAddress;
}

export interface GraphItemBody {
  contentType?: string;
  content?: string;
}

export interface GraphMessage {
  id: string;
  subject?: string;
  from?: GraphRecipient;
  sender?: GraphRecipient;
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
  receivedDateTime?: string;
  sentDateTime?: string;
  hasAttachments?: boolean;
  bodyPreview?: string;
  body?: GraphItemBody;
  webLink?: string;
  internetMessageId?: string;
  isRead?: boolean;
}

export interface GraphMessagesResponse {
  value?: GraphMessage[];
  "@odata.nextLink"?: string;
  error?: {
    code?: string;
    message?: string;
  };
}

export interface GraphAttachment {
  "@odata.type"?: string;
  id: string;
  name?: string;
  contentType?: string;
  size?: number;
  isInline?: boolean;
  contentId?: string;
}

export interface GraphAttachmentsResponse {
  value?: GraphAttachment[];
  "@odata.nextLink"?: string;
  error?: {
    code?: string;
    message?: string;
  };
}

export interface OutlookAttachmentDetail {
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline: boolean;
  contentId: string | null;
  type: string;
}

export interface OutlookDocumentLink {
  url: string;
  label: string;
}

export interface OutlookMessageDetail {
  id: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  to: string[];
  cc: string[];
  receivedDateTime: string | null;
  sentDateTime: string | null;
  bodyHtml: string;
  bodyText: string;
  bodyPreview: string;
  hasAttachments: boolean;
  attachments: OutlookAttachmentDetail[];
  documentLinks: OutlookDocumentLink[];
  webLink: string | null;
  internetMessageId: string | null;
}

export interface OutlookAttachmentDownload {
  buffer: Buffer;
  fileName: string;
  contentType: string;
}
