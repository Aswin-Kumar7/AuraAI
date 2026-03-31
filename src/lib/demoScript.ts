// Demo script data for simulating a perfect call experience

export const DEMO_TRANSCRIPT = [
  { speaker: "customer", text: "Hello, I'm calling about my recent bill. It seems much higher than usual." },
  { speaker: "agent", text: "Hello! I'd be happy to help you with your billing question. Can you please provide your account number?" },
  { speaker: "customer", text: "Sure, it's 12345-67890." },
  { speaker: "agent", text: "Thank you. Let me look that up for you. I can see your account here." },
  { speaker: "customer", text: "The bill shows charges I don't recognize. Can you explain these line items?" },
  { speaker: "agent", text: "I understand your concern. Let me review the charges. It appears there was an upgrade to your plan last month." },
  { speaker: "customer", text: "I didn't authorize any upgrade! This is unacceptable." },
  { speaker: "agent", text: "I apologize for the inconvenience. Let me check if this was an automatic upgrade or an error." },
  { speaker: "customer", text: "I want this reversed immediately! I demand a refund for the extra charges!" },
  { speaker: "agent", text: "I completely understand your frustration. Let me escalate this to our billing supervisor right away." },
  { speaker: "customer", text: "And I want to cancel my service entirely if this isn't fixed!" },
  { speaker: "agent", text: "Please hold while I connect you to our supervisor. This should only take a moment." },
  { speaker: "supervisor", text: "Hello, this is the billing supervisor. I understand there's an issue with unauthorized charges." },
  { speaker: "customer", text: "Yes! I want a full refund and to cancel my account!" },
  { speaker: "supervisor", text: "I apologize for this error. I've reviewed your account and confirmed this was an unauthorized charge. I'll process a full refund immediately." },
  { speaker: "customer", text: "Thank you. How long will the refund take?" },
  { speaker: "supervisor", text: "The refund will appear on your statement within 3-5 business days. Is there anything else I can help you with today?" },
  { speaker: "customer", text: "No, that should be it. Thank you for resolving this quickly." },
  { speaker: "supervisor", text: "You're welcome. We appreciate your business and apologize again for the inconvenience. Have a great day!" },
  { speaker: "customer", text: "You too. Goodbye." },
  { speaker: "supervisor", text: "Goodbye." },
  { speaker: "agent", text: "Thank you for your patience. The issue has been resolved." }
];

export const DEMO_SENTIMENT_ARC = [60, 55, 45, 35, 25, 20, 30, 45, 60, 75];

export const DEMO_COMPANY_CONFIG = {
  complianceKeywords: ["refund", "cancel", "legal"],
  alertThreshold: 35
};

export const DEMO_CALLER_MEMORY = {
  callCount: 3,
  lastIssue: "Network issue",
  lastResolved: true
};