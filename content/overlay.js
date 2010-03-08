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

var Cc = Components.classes;
var Ci = Components.interfaces;

var certwatch =
{
  onLoad: function()
  {
    // initialization code
    this.initialized = true;
    this.strings = document.getElementById("certwatch-strings");

    // Perform a one-off initialisation of the database file (SQLite).
    // Also, initialise the prepared SQLite statements.
    this.dbinit();
    
    this.init();
  },
  
  onMenuItemCommand: function(e)
  {
    var promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                                  .getService(Ci.nsIPromptService);
    promptService.alert(window, this.strings.getString("helloMessageTitle"),
                                this.strings.getString("helloMessage"));
  },

  dbinit: function()
  {    
    this.dbHandle = null;
    
    this.dbSelect = null;
    this.dbInsert = null;
    this.dbUpdate = null;
    
    try
    {
      var file = Cc["@mozilla.org/file/directory_service;1"]
                 .getService(Ci.nsIProperties)
                 .get("ProfD", Ci.nsIFile);
      var storage = Cc["@mozilla.org/storage/service;1"]
                    .getService(Ci.mozIStorageService);
      file.append("CertWatch.sqlite");
      
      // Must be checked before openDatabase()
      var exists = file.exists();
      
      // Now, CertWatch.sqlite exists
      this.dbHandle = storage.openDatabase(file);
      
      // CertWatch.sqlite initialization
      if (!exists) {
	// CertWatch.sql initialisation strings
	var dbTableVersionCreate = "CREATE TABLE version (version INT)";
	var dbTableVersionInsert = "INSERT INTO version (version) VALUES (1)";
	var dbTableCertificatesRoot = ""+<r><![CDATA[
		CREATE TABLE certificatesRoot (
			  hashCertificate TEXT PRIMARY KEY not NULL, 
			  derCertificate BLOB not NULL, 
			  dateFirstUsed DATE default NULL, 
			  dateLastUsed DATE default NULL,
			  countTimesUsed INTEGER default '0',
			  dateAddedToCertWatch DATE default CURRENT_TIMESTAMP, 
			  dateReAddedToMozilla DATE default NULL, 
			  dateRemovedFromMozilla DATE default NULL)
						    ]]></r>;
	var dbTableCertificatesWebsite = ""+<r><![CDATA[
		CREATE TABLE certificatesWebsite (
				hashCertificate TEXT PRIMARY KEY not NULL,
				commonNameWebsite TEXT not NULL,
				derCertificate BLOB not NULL,
				countTimesVisited INTEGER default '1', 
				dateFirstVisit DATE default CURRENT_TIMESTAMP, 
				dateLastVisit DATE default CURRENT_TIMESTAMP)
							]]></r>;
	var dbTableVisitsWebsite = ""+<r><![CDATA[
		CREATE TABLE visitsWebsite (
				commonNameWebsite TEXT not NULL, 
				hashCertificate TEXT not NULL,
				dateVisit DATE default CURRENT_TIMESTAMP, 
				urlPage TEXT not NULL, 
				urlReferer TEXT default NULL)
						  ]]></r>;
	
        this.dbHandle.executeSimpleSQL(dbTableVersionCreate);
        this.dbHandle.executeSimpleSQL(dbTableVersionInsert);
        this.dbHandle.executeSimpleSQL(dbTableCertificatesRoot);
        this.dbHandle.executeSimpleSQL(dbTableCertificatesWebsite);
        this.dbHandle.executeSimpleSQL(dbTableVisitsWebsite);
      }
      
      // Prepared SQLite statement strings
      var dbSelectStringCertificatesRootHash =
	      "SELECT * FROM certificatesRoot WHERE hashCertificate=:hash";
      var dbSelectStringCertificatesWebsiteHash =
	      "SELECT * FROM certificatesWebsite WHERE hashCertificate=:hash";
      var dbSelectStringCertificatesWebsiteCommonName =
	      "SELECT * FROM certificatesWebsite WHERE commonNameWebsite=:cn";
      var dbSelectStringVisitsCommonName =
	      "SELECT * FROM visitsWebsite WHERE commonNameWebsite=:cn";
      var dbSelectStringVisitsHash =
	      "SELECT * FROM visitsWebsite WHERE hashCertificate=:hash";
      
      var dbInsertStringCertificatesRoot = ""+<r><![CDATA[
		INSERT INTO certificatesRoot (hashCertificate, 
					      derCertificate, 
					      dateFirstUsed, 
					      dateLastUsed,
					      countTimesUsed,
					      dateAddedToCertWatch, 
					      dateReAddedToMozilla, 
					      dateRemovedFromMozilla)
		values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
							  ]]></r>;
      var dbInsertStringCertificatesWebsite = ""+<r><![CDATA[
		INSERT INTO certificatesWebsite (hashCertificate,
					      commonNameWebsite,
					      derCertificate,
					      countTimesVisited, 
					      dateFirstVisit, 
					      dateLastVisit)
		values (?1, ?2, ?3, ?4, ?5, ?6)
							    ]]></r>;
      var dbInsertStringVisits = ""+<r><![CDATA[
		INSERT INTO visitsWebsite (commonNameWebsite, 
					      hashCertificate,
					      dateVisit, 
					      urlPage, 
					      urlReferer)
		values (?1, ?2, ?3, ?4, ?5)
					       ]]></r>;
      
      var dbUpdateStringCertificatesRoot = ""+<r><![CDATA[
		UPDATE certificatesRoot SET 	
					      derCertificate=?2, 
					      dateFirstUsed=?3, 
					      dateLastUsed=?4,
					      countTimesUsed=?5,
					      dateAddedToCertWatch=?6, 
					      dateReAddedToMozilla=?7, 
					      dateRemovedFromMozilla=?8
					WHERE hashCertificate=?1
							  ]]></r>;
      var dbUpdateStringCertificatesWebsites = ""+<r><![CDATA[
		UPDATE certificatesWebsite SET
					      commonNameWebsite=?2,
					      derCertificate=?3,
					      countTimesVisited=?4, 
					      dateFirstVisit=?5, 
					      dateLastVisit=?6
					WHERE hashCertificate=?1
							      ]]></r>;
     
      // Create SQLite prepared statements
      this.dbSelectCertsRootHash =
	this.dbHandle.createStatement(dbSelectStringCertificatesRootHash);
      this.dbSelectCertsWebsiteHash =
	this.dbHandle.createStatement(dbSelectStringCertificatesWebsiteHash);
      this.dbSelectCertsWebsiteCommonName =
	this.dbHandle.createStatement(dbSelectStringCertificatesWebsiteCommonName);
      this.dbSelectVisitsCommonName =
	this.dbHandle.createStatement(dbSelectStringVisitsCommonName);
      this.dbSelectVisitsHash =
	this.dbHandle.createStatement(dbSelectStringVisitsHash);
      this.dbInsertCertsRoot =
	this.dbHandle.createStatement(dbInsertStringCertificatesRoot);
      this.dbInsertCertsWebsite =
	this.dbHandle.createStatement(dbInsertStringCertificatesWebsite);
      this.dbInsertVisits =
	this.dbHandle.createStatement(dbInsertStringVisits);
      this.dbUpdateCertsRoot =
	this.dbHandle.createStatement(dbUpdateStringCertificatesRoot);
      this.dbUpdateCertsWebsite =
	this.dbHandle.createStatement(dbUpdateStringCertificatesWebsites);
    }
    catch(err)
    {
      throw new Error("CertWatch: Error initializing SQLite operations: "+ err);
    }
  },

  init: function()
  {
    // Add event listener for Firefox for 'DOMContentLoaded'.
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
    var count = 1;
    while (certEnumerator.hasMoreElements())
    {
      var chainCert = certEnumerator.getNext().QueryInterface(Ci.nsIX509Cert);
      alert("Writing #" + count + "  CN: " + chainCert.commonName + " - Org: " + chainCert.organization +
            " - Issuer CN: " + chainCert.issuerCommonName);
      var DER = chainCert.getRawDER({});
      alert("Hash SHA256: " + this.hash(DER, DER.length));
      // this.writeCertificateFile(DER, DER.length, "/tmp");
      count++;
    }
  },
  
  writeCertificateFile: function (der, len, filepath)
  {
    var aFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
    
    aFile.initWithPath(filepath + "/RootCertificates.der");
    aFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0644);
    
    var stream = Cc["@mozilla.org/binaryoutputstream;1"].
                    createInstance(Ci.nsIBinaryOutputStream);
		    
    var foStream = Cc["@mozilla.org/network/file-output-stream;1"].
                         createInstance(Ci.nsIFileOutputStream);
    foStream.init(aFile, 0x02 | 0x08 | 0x20, 0644, 0); // write, create, truncate
    
    stream.setOutputStream(foStream);
    stream.writeByteArray(der, len);
    
    if (stream instanceof Ci.nsISafeOutputStream) {
        stream.finish();
    } else {
        stream.close();
    }
  },
  
  hash: function(data)
  {
    var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
		    createInstance(Ci.nsIScriptableUnicodeConverter);
    var ch = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);

    ch.init(ch.SHA256);
    ch.update(data, data.length);
    var hash = ch.finish(false);
    
    // convert the binary hash data to a hex string.
    var s = [this.toHexString(hash.charCodeAt(i)) for (i in hash)].join("");
    // s now contains your hash in hex: should be
    // 5eb63bbbe01eeed093cb22bb8f5acdc3
    return s;
  },

    // return the two-digit hexadecimal code for a byte  
  toHexString: function(charCode)
  {
    return ("0" + charCode.toString(16)).slice(-2);
  }
};

window.addEventListener("load", function(e) { certwatch.onLoad(e); }, false);
