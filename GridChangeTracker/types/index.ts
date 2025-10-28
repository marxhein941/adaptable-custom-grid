// Type definitions for the Grid component

export interface DataRecord {
  [key: string]: unknown;
  id?: string;
}

export interface EntityMetadata {
  isValidForUpdate: boolean;
  attributeType: string;
}

export interface ColumnMetadata {
  LogicalName?: string;
  logicalName?: string;
  Description?: {
    UserLocalizedLabel?: {
      Label?: string;
    };
  };
  description?: {
    UserLocalizedLabel?: {
      Label?: string;
    };
  };
  DisplayName?: {
    UserLocalizedLabel?: {
      Label?: string;
    };
  };
  displayName?: {
    UserLocalizedLabel?: {
      Label?: string;
    };
  };
  IsValidForUpdate?: {
    Value?: boolean;
  };
  AttributeType?: {
    Value?: string;
  };
  Attributes?: unknown[];
}

export interface EntityMetadataResponse {
  LogicalName?: string;
  logicalName?: string;
  Description?: {
    UserLocalizedLabel?: {
      Label?: string;
    };
  };
  description?: {
    UserLocalizedLabel?: {
      Label?: string;
    };
  };
  DisplayName?: {
    UserLocalizedLabel?: {
      Label?: string;
    };
  };
  displayName?: {
    UserLocalizedLabel?: {
      Label?: string;
    };
  };
  Attributes?: ColumnMetadata[];
}

export interface XrmContext {
  parent?: {
    Xrm?: XrmApi;
  };
  Xrm?: XrmApi;
}

export interface XrmApi {
  Utility?: {
    getEntityMetadata?: (entityName: string, attributes?: string[]) => Promise<EntityMetadataResponse>;
  };
}
