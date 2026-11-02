export type Lead = {
  id: string;
  sourceMessageId: string;
  product: string;
  quantity: number;
  material: string | null;
  budget: number | null;
  status: string;
  createdAt: string;
};

export type Message = {
  id: string;
  senderName: string;
  senderEmail: string;
  company: string;
  subject: string;
  body: string;
  createdAt: string;
};

export type Extraction = {
  product?: string | null;
  quantity?: number | null;
  material?: string | null;
  budget?: number | null;
};

export type LeadFormValues = {
  product: string;
  quantity: string;
  material: string;
  budget: string;
};

export const emptyLeadForm = (): LeadFormValues => ({
  product: "",
  quantity: "",
  material: "",
  budget: "",
});
