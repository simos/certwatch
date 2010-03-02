/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 * 
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Certificate Watch.
 *
 * The Initial Developer of the Original Code is
 * Simos Xenitellis.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * 
 * ***** END LICENSE BLOCK ***** */

var certwatch =
{
  onLoad: function()
  {
    // initialization code
    this.initialized = true;
    this.strings = document.getElementById("certwatch-strings");
    
    this.init();
  },
  
  onMenuItemCommand: function(e)
  {
    var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                  .getService(Components.interfaces.nsIPromptService);
    promptService.alert(window, this.strings.getString("helloMessageTitle"),
                                this.strings.getString("helloMessage"));
  },

  init: function(e)
  {
    // adding event listener for Firefox
    var content = document.getElementById("content");
    if (content)
    {
      content.addEventListener("DOMContentLoaded", this.onPageLoad, true);
    }
  },
  
  onPageLoad: function(aEvent)
  {
    var doc = aEvent.originalTarget;
    if (doc.location.protocol == "https:")
    {
      certwatch.onSecurePageLoad(doc);
    }
  },
  
  onSecurePageLoad: function(doc)
  {
    const Ci = Components.interfaces;
    
    var serverCert;
    var validity;
    var commonName;
    var organization;
    var issuerCommonName;
    var issuerOrganization;
    var issuerOrganizationUnit;
    
    // Finds the right tab that issues the SecurePageLoad event.
    // We then load the corresponding securityUI for this event.
    var browser = gBrowser.getBrowserForDocument(doc);
    if (!browser)
      return
    
    var securityUI = browser.securityUI;
    if (!securityUI)
      return;
    
    var sslStatusProvider = securityUI.QueryInterface(Ci.nsISSLStatusProvider);
    if (!sslStatusProvider)
      return;
    
    var sslStatus = sslStatusProvider.SSLStatus;
    if (!sslStatus)
      return;
    
    var sslStatusStruct = sslStatus.QueryInterface(Ci.nsISSLStatus);
    if (!sslStatusStruct)
      return;
    
    serverCert = sslStatusStruct.serverCert;
    if (!serverCert)
      return;
    
    validity = serverCert.validity.QueryInterface(Ci.nsIX509CertValidity);
    if (!validity)
      return;
    
    commonName = serverCert.commonName;
    organization = serverCert.organization;
    issuerCommonName = serverCert.issuerCommonName;
    issuerOrganization = serverCert.issuerOrganization;
    issuerOrganizationUnit = serverCert.issuerOrganizationUnit;
    
    // alert(commonName + " " + organization + " " + issuerCommonName + " " +
    //      issuerOrganization + " " + issuerOrganizationUnit);
    var certArray = serverCert.getChain();
    var certEnumerator = certArray.enumerate();
    while (certEnumerator.hasMoreElements())
    {
      var chainCert = certEnumerator.getNext().QueryInterface(Ci.nsIX509Cert);
      alert("CN: " + chainCert.commonName + " - Org: " + chainCert.organization +
            " - Issuer CN: " + chainCert.issuerCommonName);
    }
  }
};

window.addEventListener("load", function(e) { certwatch.onLoad(e); }, false);
