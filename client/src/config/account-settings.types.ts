/**
 * Account Settings page configuration types.
 * This JSON shape can be shared with the backend later – the API can return this config per role/locale.
 */

export interface NavItem {
  id: string;
  label: string;
  icon: string;
}

export interface HeaderAction {
  id: string;
  label: string;
  icon: string;
  href: string;
}

export interface FormField {
  id: string;
  label: string;
  type: "text" | "email" | "textarea";
  placeholder?: string;
  rows?: number;
  gridCol?: "full" | "half";
}

export interface ProfileSectionConfig {
  title: string;
  avatar: {
    sectionLabel: string;
    uploadLabel: string;
    removeLabel: string;
    removeConfirmTitle: string;
    removeConfirmDescription: string;
    removeConfirmButton: string;
    removeCancelButton: string;
  };
  fields: FormField[];
  saveLabel: string;
  savingLabel: string;
}

export interface SecurityField {
  id: string;
  label: string;
  type: "password";
  placeholder: string;
}

export interface SecuritySectionConfig {
  title: string;
  fields: SecurityField[];
  twoFactor: {
    title: string;
    description: string;
    buttonLabel: string;
    confirmTitle: string;
    confirmDescription: string;
    confirmButton: string;
    cancelButton: string;
    successTitle: string;
    successDescription: string;
  };
  activeSessions: {
    title: string;
    sessionLabel: string;
    sessionDescription: string;
    currentBadge: string;
  };
  updatePasswordLabel: string;
  updatingLabel: string;
}

export interface NotificationToggle {
  id: string;
  label: string;
  description: string;
  defaultValue: boolean;
}

export interface NotificationsSectionConfig {
  title: string;
  toggles: NotificationToggle[];
  saveLabel: string;
  successTitle: string;
  successDescription: string;
}

export interface BillingPlanConfig {
  title: string;
  planName: string;
  statusBadge: string;
  creditsLabel: string;
  nextBillingLabel: string;
  /** From backend when subscription/billing data exists; otherwise "—" shown */
  nextBillingDate?: string | null;
}

export interface PaymentMethodConfig {
  title: string;
  maskLabel: string;
  expiresLabel: string;
  updateButtonLabel: string;
  updatePromptTitle: string;
  updatePromptDescription: string;
  updatePromptPlaceholder: string;
  successTitle: string;
  successDescription: string;
  invalidTitle: string;
  invalidDescription: string;
}

export interface TransactionItem {
  id: string;
  description: string;
  date: string;
  amount: string;
}

export interface BillingSectionConfig {
  title: string;
  plan: BillingPlanConfig;
  paymentMethod: PaymentMethodConfig;
  transactionsTitle: string;
  transactions: TransactionItem[];
  downloadInvoiceLabel: string;
  cancelSubscriptionLabel: string;
  cancelConfirmTitle: string;
  cancelConfirmDescription: string;
  cancelConfirmButton: string;
  cancelKeepButton: string;
  cancelSuccessTitle: string;
  cancelSuccessDescription: string;
  invoiceDownloadedTitle: string;
  invoiceDownloadedDescription: string;
}

export interface SidebarConfig {
  settingsLabel: string;
  nav: NavItem[];
  userCard: {
    creditsLabel: string;
    creditsSuffix: string;
    showCreditsBar: boolean;
  };
}

export interface AccountSettingsConfig {
  page: {
    title: string;
    subtitle: string;
  };
  headerActions: HeaderAction[];
  sidebar: SidebarConfig;
  sections: {
    profile: ProfileSectionConfig;
    security: SecuritySectionConfig;
    notifications: NotificationsSectionConfig;
    billing: BillingSectionConfig;
  };
}
