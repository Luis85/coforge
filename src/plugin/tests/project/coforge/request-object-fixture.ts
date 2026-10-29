import { requestObjectDefinitionCheck } from "../../../features/coforge/domain/request-object";
export const objectDefinition = () =>
  requestObjectDefinitionCheck({
    format: "coforge-request-object/v1",
    className: "Business Idea",
    fields: [
      {
        key: "business-value",
        label: "Business value",
        type: "number",
        defaultValue: 0,
      },
      { key: "customer", label: "Customer", type: "text" },
      { key: "target-date", label: "Target date", type: "date" },
      {
        key: "validated",
        label: "Validated",
        type: "checkbox",
        defaultValue: false,
      },
      {
        key: "priority",
        label: "Priority",
        type: "select",
        options: ["Low", "High"],
        defaultValue: "Low",
      },
    ],
  });
