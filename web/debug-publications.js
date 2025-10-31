// Debug script to test publication data format
// Run this in the browser console on the home page

console.log('=== DEBUGGING PUBLICATION DATA ===');

// Check if TanStack Query data is available
const queryClient = window.__REACT_QUERY_CLIENT__;
if (queryClient) {
  const queries = queryClient.getQueryCache().getAll();
  const publicationsQuery = queries.find(q => q.queryKey.includes('my'));
  
  if (publicationsQuery) {
    console.log('Publications Query Data:', publicationsQuery.state.data);
    console.log('Publications Query Status:', publicationsQuery.state.status);
    
    if (publicationsQuery.state.data) {
      console.log('Raw Publications:', publicationsQuery.state.data);
      
      publicationsQuery.state.data.forEach((pub, index) => {
        console.log(`Publication ${index}:`, {
          _id: pub._id,
          slug: pub.slug,
          messageText: pub.messageText,
          type: pub.type,
          tgAuthorName: pub.tgAuthorName,
          tgAuthorId: pub.tgAuthorId,
          meta: pub.meta
        });
        
        // Check filtering logic
        const passesFilter = pub.messageText || pub.type === 'poll';
        console.log(`  Passes filter (messageText || type === 'poll'):`, passesFilter);
        console.log(`  messageText:`, pub.messageText);
        console.log(`  type:`, pub.type);
      });
    }
  } else {
    console.log('No publications query found');
  }
} else {
  console.log('React Query client not found');
}

// Also check the component state
console.log('=== CHECKING COMPONENT STATE ===');
const homePageElement = document.querySelector('[data-testid="home-page"]') || document.querySelector('.balance');
if (homePageElement) {
  console.log('Home page element found:', homePageElement);
} else {
  console.log('Home page element not found');
}
