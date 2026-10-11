const address = value => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export function microsoftEmailNotifier({tenantId = process.env.MICROSOFT_TENANT_ID, clientId = process.env.MICROSOFT_CLIENT_ID, clientSecret = process.env.MICROSOFT_CLIENT_SECRET, from = process.env.SCRUBS_EMAIL_FROM || 'manager@landrument.com', to = process.env.SCRUBS_ORDER_EMAIL || 'manager@landrument.com', fetchImpl = fetch} = {}) {
  if (!address(to) || !address(from)) throw Error('Configure valid Microsoft sender and recipient addresses.');
  const configured = Boolean(tenantId && clientId && clientSecret);
  if (tenantId && !/^[a-f0-9-]{36}$/i.test(tenantId)) throw Error('Use the Microsoft directory tenant ID.');
  let cachedToken, expiresAt = 0;
  return {
    configured, to,
    async send(order) {
      if (!configured) return {status:'not_configured',to};
      let token = cachedToken;
      if (!token || Date.now() >= expiresAt) {
        try {
          const response = await fetchImpl(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'}).toString(), signal:AbortSignal.timeout(10000)});
          if (!response.ok) return {status:'failed',to};
          const result = await response.json();if(!result.access_token) return {status:'failed',to};
          token = cachedToken = result.access_token;
          expiresAt = Date.now() + Math.max(0,Number(result.expires_in || 0)-60)*1000;
        } catch {return {status:'failed',to};}
      }
      const lines = order.items.map(item=>`${item.quantity} × ${item.name} (${item.sku || item.id})\n${item.collection} · ${item.color} · Size ${item.size}${item.inseam ? ' · Inseam '+item.inseam : ''}\n${item.allowance}${item.setColor !== item.color ? ' · Counts toward '+item.setColor+' set' : ''}\n${item.url}`);
      const text = `New Landrum ENT scrub order\n\nEmployee: ${order.employee.name}\nWork email: ${order.employee.email}\nOrder reference: ${order.id}\nSubmitted: ${order.createdAt}\n\n${lines.join('\n\n')}\n\n${order.estimatedValue == null ? 'Some items have no price; estimated total is unavailable.' : 'Estimated total value: $'+order.estimatedValue.toFixed(2)}\nNo payment required.\n\nAdministrator workspace: https://scrubs.onrender.com/admin`;
      try {
        const response=await fetchImpl(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`, {method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','client-request-id':order.id},body:JSON.stringify({message:{subject:'Landrum ENT scrub order — '+order.employee.name.replace(/[\r\n]/g,' '),body:{contentType:'Text',content:text},toRecipients:[{emailAddress:{address:to}}],replyTo:[{emailAddress:{address:order.employee.email}}]},saveToSentItems:true}),signal:AbortSignal.timeout(10000)});
        if (response.status===401) {cachedToken=undefined;expiresAt=0;}
        if(response.status!==202) return {status:'failed',to};
        return {status:'sent',to,sentAt:new Date().toISOString()};
      } catch {return {status:'uncertain',to};}
    }
  };
}
