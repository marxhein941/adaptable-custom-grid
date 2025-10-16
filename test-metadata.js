// Test script to check entity metadata directly
// Run this in the browser console when your app is open

async function testMetadata() {
    const entityType = 'opalcrm_manufacturedsalesforecastingtotal';

    console.log('Testing metadata for entity:', entityType);

    try {
        // Method 1: Using Xrm.Utility
        if (window.parent?.Xrm?.Utility?.getEntityMetadata) {
            console.log('Testing Xrm.Utility.getEntityMetadata...');
            const metadata = await window.parent.Xrm.Utility.getEntityMetadata(entityType, ['Attributes']);

            console.log('Full metadata response:', metadata);
            console.log('Number of attributes:', metadata?.Attributes?.length || 0);

            if (metadata?.Attributes) {
                // Check first 5 attributes for descriptions
                metadata.Attributes.slice(0, 5).forEach(attr => {
                    console.log(`Column: ${attr.LogicalName}`);
                    console.log(`  DisplayName: ${attr.DisplayName?.UserLocalizedLabel?.Label || 'N/A'}`);
                    console.log(`  Description: ${attr.Description?.UserLocalizedLabel?.Label || 'N/A'}`);
                });

                // Count how many have descriptions
                const withDescriptions = metadata.Attributes.filter(attr =>
                    attr.Description?.UserLocalizedLabel?.Label
                ).length;

                console.log(`\nColumns with descriptions: ${withDescriptions}/${metadata.Attributes.length}`);
            }
        }

        // Method 2: Direct Web API call
        console.log('\nTesting direct Web API...');
        const clientUrl = window.parent?.Xrm?.Utility?.getGlobalContext?.()?.getClientUrl?.() || '';

        if (clientUrl) {
            const apiUrl = `${clientUrl}/api/data/v9.2/EntityDefinitions(LogicalName='${entityType}')?$select=LogicalName&$expand=Attributes($select=LogicalName,DisplayName,Description)`;
            console.log('API URL:', apiUrl);
            console.log('Open this URL in a new tab to see the raw metadata');

            // You can also fetch it directly if you have a token
            // This will likely fail due to CORS in console, but the URL above will work in a new tab
        }

    } catch (error) {
        console.error('Error testing metadata:', error);
    }
}

// Run the test
testMetadata();