// Metadata configuration for column tooltips
// This data is extracted from the CRM entity metadata and stored locally for quick access

interface LocalizedLabel {
    Label: string;
    LanguageCode: number;
    IsManaged: boolean;
    MetadataId: string;
    HasChanged: null;
}

interface FieldDescription {
    LocalizedLabels: LocalizedLabel[];
    UserLocalizedLabel: LocalizedLabel | null;
}

interface AttributeMetadata {
    '@odata.type'?: string;
    MetadataId: string;
    LogicalName: string;
    Description: FieldDescription;
    DisplayName: FieldDescription;
}

interface EntityMetadata {
    '@odata.context': string;
    MetadataId: string;
    LogicalName: string;
    Attributes: AttributeMetadata[];
}

// Import the metadata JSON directly
// You can update this with the actual metadata from your CRM system
export const entityMetadata: EntityMetadata = {
    "@odata.context": "$metadata#EntityDefinitions(LogicalName,Attributes(LogicalName,DisplayName,Description))/$entity",
    "MetadataId": "8f31eabd-8914-ef11-840a-000d3ad2b065",
    "LogicalName": "opalcrm_manufacturedsalesforecastingtotal",
    "Attributes": [
        {
            "@odata.type": "#Microsoft.Dynamics.CRM.LookupAttributeMetadata",
            "MetadataId": "f56dfd6d-109d-4035-9d35-97a28a3ab4e7",
            "LogicalName": "createdby",
            "Description": {
                "LocalizedLabels": [
                    {
                        "Label": "Unique identifier of the user who created the record.",
                        "LanguageCode": 1033,
                        "IsManaged": false,
                        "MetadataId": "a831eabd-8914-ef11-840a-000d3ad2b065",
                        "HasChanged": null
                    }
                ],
                "UserLocalizedLabel": {
                    "Label": "Unique identifier of the user who created the record.",
                    "LanguageCode": 1033,
                    "IsManaged": false,
                    "MetadataId": "a831eabd-8914-ef11-840a-000d3ad2b065",
                    "HasChanged": null
                }
            },
            "DisplayName": {
                "LocalizedLabels": [
                    {
                        "Label": "Created By",
                        "LanguageCode": 1033,
                        "IsManaged": false,
                        "MetadataId": "a931eabd-8914-ef11-840a-000d3ad2b065",
                        "HasChanged": null
                    }
                ],
                "UserLocalizedLabel": {
                    "Label": "Created By",
                    "LanguageCode": 1033,
                    "IsManaged": false,
                    "MetadataId": "a931eabd-8914-ef11-840a-000d3ad2b065",
                    "HasChanged": null
                }
            }
        },
        {
            "@odata.type": "#Microsoft.Dynamics.CRM.DateTimeAttributeMetadata",
            "MetadataId": "a726bc37-ac71-4ba4-8861-36f9da159948",
            "LogicalName": "createdon",
            "Description": {
                "LocalizedLabels": [
                    {
                        "Label": "Date and time when the record was created.",
                        "LanguageCode": 1033,
                        "IsManaged": false,
                        "MetadataId": "a631eabd-8914-ef11-840a-000d3ad2b065",
                        "HasChanged": null
                    }
                ],
                "UserLocalizedLabel": {
                    "Label": "Date and time when the record was created.",
                    "LanguageCode": 1033,
                    "IsManaged": false,
                    "MetadataId": "a631eabd-8914-ef11-840a-000d3ad2b065",
                    "HasChanged": null
                }
            },
            "DisplayName": {
                "LocalizedLabels": [
                    {
                        "Label": "Created On",
                        "LanguageCode": 1033,
                        "IsManaged": false,
                        "MetadataId": "a731eabd-8914-ef11-840a-000d3ad2b065",
                        "HasChanged": null
                    }
                ],
                "UserLocalizedLabel": {
                    "Label": "Created On",
                    "LanguageCode": 1033,
                    "IsManaged": false,
                    "MetadataId": "a731eabd-8914-ef11-840a-000d3ad2b065",
                    "HasChanged": null
                }
            }
        },
        {
            "@odata.type": "#Microsoft.Dynamics.CRM.LookupAttributeMetadata",
            "MetadataId": "1a8c1f84-8cd2-46f5-bfcf-d86bfdb97d82",
            "LogicalName": "modifiedby",
            "Description": {
                "LocalizedLabels": [
                    {
                        "Label": "Unique identifier of the user who modified the record.",
                        "LanguageCode": 1033,
                        "IsManaged": false,
                        "MetadataId": "ab31eabd-8914-ef11-840a-000d3ad2b065",
                        "HasChanged": null
                    }
                ],
                "UserLocalizedLabel": {
                    "Label": "Unique identifier of the user who modified the record.",
                    "LanguageCode": 1033,
                    "IsManaged": false,
                    "MetadataId": "ab31eabd-8914-ef11-840a-000d3ad2b065",
                    "HasChanged": null
                }
            },
            "DisplayName": {
                "LocalizedLabels": [
                    {
                        "Label": "Modified By",
                        "LanguageCode": 1033,
                        "IsManaged": false,
                        "MetadataId": "ac31eabd-8914-ef11-840a-000d3ad2b065",
                        "HasChanged": null
                    }
                ],
                "UserLocalizedLabel": {
                    "Label": "Modified By",
                    "LanguageCode": 1033,
                    "IsManaged": false,
                    "MetadataId": "ac31eabd-8914-ef11-840a-000d3ad2b065",
                    "HasChanged": null
                }
            }
        },
        {
            "@odata.type": "#Microsoft.Dynamics.CRM.DateTimeAttributeMetadata",
            "MetadataId": "eb9e03e9-7de9-4f02-a7d5-40bbe2c88f24",
            "LogicalName": "modifiedon",
            "Description": {
                "LocalizedLabels": [
                    {
                        "Label": "Date and time when the record was modified.",
                        "LanguageCode": 1033,
                        "IsManaged": false,
                        "MetadataId": "a931eabd-8914-ef11-840a-000d3ad2b065",
                        "HasChanged": null
                    }
                ],
                "UserLocalizedLabel": {
                    "Label": "Date and time when the record was modified.",
                    "LanguageCode": 1033,
                    "IsManaged": false,
                    "MetadataId": "a931eabd-8914-ef11-840a-000d3ad2b065",
                    "HasChanged": null
                }
            },
            "DisplayName": {
                "LocalizedLabels": [
                    {
                        "Label": "Modified On",
                        "LanguageCode": 1033,
                        "IsManaged": false,
                        "MetadataId": "aa31eabd-8914-ef11-840a-000d3ad2b065",
                        "HasChanged": null
                    }
                ],
                "UserLocalizedLabel": {
                    "Label": "Modified On",
                    "LanguageCode": 1033,
                    "IsManaged": false,
                    "MetadataId": "aa31eabd-8914-ef11-840a-000d3ad2b065",
                    "HasChanged": null
                }
            }
        }
    ]
};

// Helper function to get column descriptions from metadata
export function getColumnDescriptions(): Map<string, string> {
    const descriptions = new Map<string, string>();

    entityMetadata.Attributes.forEach(attr => {
        // Get description, fallback to display name
        const description = attr.Description?.UserLocalizedLabel?.Label ||
                          attr.Description?.LocalizedLabels?.[0]?.Label;
        const displayName = attr.DisplayName?.UserLocalizedLabel?.Label ||
                          attr.DisplayName?.LocalizedLabels?.[0]?.Label;

        // Use description if available, otherwise use display name
        const tooltipText = description || displayName;

        if (attr.LogicalName && tooltipText) {
            descriptions.set(attr.LogicalName, tooltipText);
        }
    });

    return descriptions;
}

// Export default column descriptions for common system fields
export const defaultColumnDescriptions: Record<string, string> = {
    'createdby': 'Unique identifier of the user who created the record.',
    'createdon': 'Date and time when the record was created.',
    'modifiedby': 'Unique identifier of the user who modified the record.',
    'modifiedon': 'Date and time when the record was modified.',
    'statecode': 'Status of the record.',
    'statuscode': 'Reason for the status of the record.',
    'ownerid': 'Owner of the record.',
    'owningbusinessunit': 'Business unit that owns the record.',
    'owningteam': 'Team that owns the record.',
    'owninguser': 'User who owns the record.',
    'versionnumber': 'Version number of the record.',
    'importsequencenumber': 'Sequence number for record import.',
    'overriddencreatedon': 'Date and time that the record was migrated.',
    'timezoneruleversionnumber': 'For internal use only.',
    'utcconversiontimezonecode': 'Time zone code used for record conversion.'
};