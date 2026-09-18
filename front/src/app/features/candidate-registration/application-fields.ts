export interface ApplicationField {
  key: string;
  label: string;
  type?: "date";
  maxLength?: number;
  pattern?: string;
  options?: { value: string; label: string }[];
}

const yesNo = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

/** Optional operational questions adapted from the supplied application form. */
export const APPLICATION_SECTIONS: {
  title: string;
  fields: ApplicationField[];
}[] = [
  {
    title: "Application details",
    fields: [
      { key: "preferredSite", label: "Preferred site", maxLength: 120 },
      { key: "town", label: "Town / city", maxLength: 100 },
      { key: "cityOfBirth", label: "City of birth", maxLength: 100 },
      { key: "countryOfBirth", label: "Country of birth", maxLength: 100 },
      {
        key: "ukEntryDate",
        label: "Date of entry to the UK (if applicable)",
        type: "date",
      },
      {
        key: "utr",
        label: "UTR (10 digits, if available)",
        maxLength: 10,
        pattern: "^[0-9]{10}$",
      },
      { key: "referredBy", label: "Referred by", maxLength: 150 },
    ],
  },
  {
    title: "Licence and delivery experience",
    fields: [
      {
        key: "licenceType",
        label: "Driving licence type",
        options: [
          { value: "UK", label: "UK" },
          { value: "EU", label: "EU" },
          { value: "OTHER", label: "Other" },
        ],
      },
      { key: "licenceValidFrom", label: "Licence valid from", type: "date" },
      {
        key: "pointsDetails",
        label: "Details of licence points (if applicable)",
        maxLength: 1000,
      },
      {
        key: "deliveryExperience",
        label: "Previous delivery experience?",
        options: yesNo,
      },
      {
        key: "previousCompany",
        label: "Previous delivery company",
        maxLength: 200,
      },
      {
        key: "experienceDuration",
        label: "How long did you work there?",
        maxLength: 100,
      },
      { key: "availableFrom", label: "Available to start from", type: "date" },
    ],
  },
  {
    title: "Vehicle",
    fields: [
      { key: "ownVan", label: "Do you own a van?", options: yesNo },
      { key: "vanMakeModel", label: "Van make and model", maxLength: 150 },
      {
        key: "courierInsurance",
        label: "Do you have courier insurance?",
        options: yesNo,
      },
      {
        key: "hireVan",
        label: "Would you like to hire a van?",
        options: yesNo,
      },
    ],
  },
];
