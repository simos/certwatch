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
    
    // Creates the initial storage of the browser root certificates, or
    // compares the current set of browser root certificates with those stored.
    this.updateRootCertificates();
    
    this.init();
    
    // this.demo();
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
      var dbExists = file.exists();
      
      // Now, CertWatch.sqlite exists
      this.dbHandle = storage.openDatabase(file);
      
      // CertWatch.sqlite initialization
      if (!dbExists)
      {
	// CertWatch.sql initialisation strings
	var dbTableVersionCreate = "CREATE TABLE version (version INT)";
	var dbTableVersionInsert = "INSERT INTO version (version) VALUES (1)";
	var dbTableCertificatesRoot = ""+<r><![CDATA[
		CREATE TABLE certificatesRoot (
			  hashCertificate TEXT PRIMARY KEY not NULL, 
			  derCertificate TEXT not NULL, 
			  commonNameRoot TEXT not NULL,
			  organizationalUnitRoot TEXT not NULL,
			  dateAddedToCertWatch DATE default CURRENT_TIMESTAMP, 
			  dateReAddedToMozilla DATE default NULL, 
			  dateRemovedFromMozilla DATE default NULL,
			  dateFirstUsed DATE default NULL, 
			  dateLastUsed DATE default NULL,
			  countTimesUsed INTEGER default '0')
						     ]]></r>;
	var dbTableCertificatesWebsite = ""+<r><![CDATA[
		CREATE TABLE certificatesWebsite (
			  hashCertificate TEXT PRIMARY KEY not NULL,
			  derCertificate TEXT not NULL,
			  commonNameWebsite TEXT not NULL,
			  dateFirstVisit DATE default CURRENT_TIMESTAMP, 
			  dateLastVisit DATE default CURRENT_TIMESTAMP,
			  countTimesVisited INTEGER default '1')
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
					      commonNameRoot,
					      organizationalUnitRoot)
		values (?1, ?2, ?3, ?4)
							  ]]></r>;
      var dbInsertStringCertificatesWebsite = ""+<r><![CDATA[
		INSERT INTO certificatesWebsite (hashCertificate,
					      derCertificate,
					      commonNameWebsite,
					      dateFirstVisit, 
					      dateLastVisit,
					      countTimesVisited)
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
					      dateAddedToCertWatch=:dateAddedToCertWatch, 
					      dateReAddedToMozilla=:dateReAddedToMozilla, 
					      dateRemovedFromMozilla=:dateRemovedFromMozilla,
					      dateFirstUsed=:dateFirstUsed, 
					      dateLastUsed=:dateLastUsed,
					      countTimesUsed=:countTimesUsed
					WHERE hashCertificate=:hashCertificate
							  ]]></r>;
      var dbUpdateStringCertificatesRootWeb = ""+<r><![CDATA[
		UPDATE certificatesRoot SET
					      dateFirstUsed=:dateFirstUsed, 
					      dateLastUsed=:dateLastUsed,
					      countTimesUsed=:countTimesUsed
					WHERE hashCertificate=:hashCertificate
							  ]]></r>;
      var dbUpdateStringCertificatesWebsites = ""+<r><![CDATA[
		UPDATE certificatesWebsite SET
					      dateFirstVisit=:dateFirstVisit,
					      dateLastVisit=:dateLastVisit,
					      countTimesVisited=:countTimesVisited
					WHERE hashCertificate=:hashCertificate;
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
      this.dbUpdateCertsRootWeb =
	this.dbHandle.createStatement(dbUpdateStringCertificatesRootWeb);
      this.dbUpdateCertsWebsite =
	this.dbHandle.createStatement(dbUpdateStringCertificatesWebsites);
    }
    catch(err)
    {
      throw new Error("CertWatch: Error initializing SQLite operations: "+ err);
      backupDatabaseFile(file);
    }
    
    if (!dbExists)
    {
      var moz_x509certdb2 = Cc['@mozilla.org/security/x509certdb;1']
                          .getService(Ci.nsIX509CertDB2);
      var allRootCertificates = moz_x509certdb2.getCerts();
      var enumRootCertificates = allRootCertificates.getEnumerator();
      
      var statement = this.dbInsertCertsRoot;
      
      while (enumRootCertificates.hasMoreElements())
      {
        var thisElement = enumRootCertificates.getNext();
        var thisCertificate = thisElement.QueryInterface(Ci.nsIX509Cert);          
        var DER = thisCertificate.getRawDER({});
	
	try
	{
	  statement.bindUTF8StringParameter(0, 	// "hashCertificate"
					    this.hash(DER, DER.length));
	  statement.bindUTF8StringParameter(1, 	// "derCertificate"
				      this.base64_encode(DER));
	  statement.bindUTF8StringParameter(2, 	// "commonNameRoot"
				      thisCertificate.commonName);
	  statement.bindUTF8StringParameter(3, 	// "organizationalUnitRoot"
				      thisCertificate.organizationalUnit);
	  
	  statement.execute();
	}
	catch (err)
	{
	  throw new Error("CertWatch: Error adding root certficates at init: "+ err);
	}
	finally
	{
	  statement.reset();
	}
      }
    }
  },
  
  updateRootCertificates: function()
  {

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
    
    var certArray = serverCert.getChain();
    var certEnumerator = certArray.enumerate();
    
    //var statementSearchForRoot = this.dbSelectCertsRootHash;
    //var statementUpdateRoot = this.dbUpdateCertsRoot;
    
    var firstTime = true;
    
    while (certEnumerator.hasMoreElements())
    {
      var chainCert = certEnumerator.getNext().QueryInterface(Ci.nsIX509Cert);
      var DER = chainCert.getRawDER({});
      
      if (firstTime)
      {
	firstTime = false;
	this.doWebsiteCertificateWasAccessed(this.hash(DER, DER.length),
					     chainCert.commonName,
					     DER);
      }
      else
      {
	this.doRootCertificateWasAccessed(this.hash(DER, DER.length));
      }
      
      try
      {
	
      }
      catch (err)
      {
	throw new Error("CertWatch: Error adding root certficates at init: "+ err);
      }
      finally
      {
	// statementSearchForRoot.reset();
      }
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
    var hashString = ch.finish(false);
    
    // convert the binary hash data to a hex string.
    var s = [this.toHexString(hashString.charCodeAt(i)) for (i in hashString)].join("");
    // s now contains your hash in hex: should be
    // 5eb63bbbe01eeed093cb22bb8f5acdc3
    return s;
  },

  // return the two-digit hexadecimal code for a byte  
  toHexString: function(charCode)
  {
    return ("0" + charCode.toString(16)).slice(-2);
  },
  
  debug: function(arg)
  {
    if (typeof arg == "object")
    {
      dump("Dumping object " + arg.toString());

      for (var i in arg)
      {
	dump('Object[' + i + '] = ' + arg[i] + '\n');
      }
    }
    else
    {
      dump(arg)
    }
  },

  // Case: the user visited a secure website which references root cert 'certHash'.
  //   	Caveat A: We assume root cert exists in browser root cert collection.
  // 1. Search root certs (in SQLite DB) for certHash. Cache the results
  // 2. Update the rootCert data for said certificate.
  //		dateFirstUsed -> if null, dateFirstUsed = current timedate.
  //		dateLastUsed -> current timedate.
  //		countTimesUsed -> +1
  doRootCertificateWasAccessed: function(certHash)
  {
    try
    {
      this.dbSelectCertsRootHash.params.hash = certHash;
      
      if (this.dbSelectCertsRootHash.executeStep())
      {
	var now = Date();
	var nowAbsolute = Date.parse(now.toString());  // TODO: Not used yet;
    	
	var storedRootCertFirstUsed = this.dbSelectCertsRootHash.getUTF8String(7);
	var storedRootCertLastUsed  = this.dbSelectCertsRootHash.getUTF8String(8);
	var storedRootCertTimesUsed = this.dbSelectCertsRootHash.getInt64(9);
	var storedRootCertFirstNull = this.dbSelectCertsRootHash.getIsNull(7);
    	
	this.dbUpdateCertsRootWeb.params.hashCertificate = certHash;
	
	this.dbUpdateCertsRootWeb.params.countTimesUsed = storedRootCertTimesUsed + 1;
	if (storedRootCertFirstNull)
	{
	  this.dbUpdateCertsRootWeb.params.dateFirstUsed = now;
	}
	else
	{
	  this.dbUpdateCertsRootWeb.params.dateFirstUsed = storedRootCertFirstUsed;
	}
	this.dbUpdateCertsRootWeb.params.dateLastUsed = now;
	
	alert("Updated root cert " + certHash + " for date " + now + " at " +
				    (storedRootCertTimesUsed + 1) + " times.");	
	this.dbUpdateCertsRootWeb.execute();
      }
      else
      {
	alert("Root certificate " + certHash + " was not found.");
      }
    }
    catch(err)
    {
	throw new Error("CertWatch: Error at doRootCertificateWasAccessed: "+ err);
	
	// Re-evaluate if we need these. Put for now for DB sanity.
	//  this.dbSelectCertsRootHash.reset();
	//  this.dbUpdateCertsRoot.reset();
    }
    finally
    {
      this.dbSelectCertsRootHash.reset();
      this.dbUpdateCertsRootWeb.reset();
    }
  },

  // Case: the user visited a secure website with certificate hash 'certHash'.
  // 1. Search root certs (in SQLite DB) for certHash. Cache the results
  // 2. Update the rootCert data for said certificate.
  //		dateFirstUsed -> if null, dateFirstUsed = current timedate.
  //		dateLastUsed -> current timedate.
  //		countTimesUsed -> +1
  doWebsiteCertificateWasAccessed: function(certHash, CN, DER)
  {
    var now = Date();
    var nowAbsolute = Date.parse(now.toString());  // Not used yet;
    var size, data;
      	    
    try
    {
      this.dbSelectCertsWebsiteHash.params.hash = certHash;
      
      if (this.dbSelectCertsWebsiteHash.executeStep())
      {	
	var storedWebsiteFirstVisit = this.dbSelectCertsWebsiteHash.getUTF8String(3);
	var storedWebsiteLastVisit  = this.dbSelectCertsWebsiteHash.getUTF8String(4);
	var storedWebsiteTimesVisited = this.dbSelectCertsWebsiteHash.getInt64(5);
	var storedWebsiteFirstNull = this.dbSelectCertsWebsiteHash.getIsNull(3);
      	
	this.dbUpdateCertsWebsite.params.hashCertificate = certHash;
	
	this.dbUpdateCertsWebsite.params.countTimesVisited = storedWebsiteTimesVisited + 1;
	if (storedWebsiteFirstNull)
	{
	  this.dbUpdateCertsWebsite.params.dateFirstVisit = now;
	}
	else
	{
	  this.dbUpdateCertsWebsite.params.dateFirstVisit = storedWebsiteFirstVisit;
	}
	this.dbUpdateCertsWebsite.params.dateLastVisit = now;

	alert("Updated website cert of " + CN + " for date " + now + " with " +
				    certHash + " hash.");
	
	this.dbUpdateCertsWebsite.execute();
      }
      else
      {	
	this.dbInsertCertsWebsite.bindUTF8StringParameter(0, certHash);
	this.dbInsertCertsWebsite.bindUTF8StringParameter(1, this.base64_encode(DER));
	this.dbInsertCertsWebsite.bindUTF8StringParameter(2, CN);
	this.dbInsertCertsWebsite.bindUTF8StringParameter(3, now);
	this.dbInsertCertsWebsite.bindUTF8StringParameter(4, now);
	this.dbInsertCertsWebsite.bindInt64Parameter(5, 1);
	
	this.dbInsertCertsWebsite.execute();
	alert("Inserted website cert of " + CN + " for date " + now + " with " +
				    certHash + " hash.");
      }
    }
    catch(err)
    {
	throw new Error("CertWatch: Error at doWebsiteCertificateWasAccessed: "+ err);
	
	// Re-evaluate if we need these. Put for now for DB sanity.
	//  this.dbSelectCertsRootHash.reset();
	//  this.dbUpdateCertsRoot.reset();
    }
    finally
    {
      this.dbSelectCertsWebsiteHash.reset();
      this.dbInsertCertsWebsite.reset();
      this.dbUpdateCertsWebsite.reset();
    }
  },
  
  demo: function()
  {
    try
    {
      var myhash = "05a6db389391df92e0be93fdfa4db1e3cf53903918b8d9d85a9c396cb55df030";
      var myString = "UPDATE CertificatesRoot SET countTimesUsed=:times WHERE hashCertificate=:hash";
      var myReadSt = "SELECT * FROM CertificatesRoot WHERE hashCertificate=:hash";
      var myUpdate = this.dbHandle.createStatement(myString);
      var myRead = this.dbHandle.createStatement(myReadSt);    
      
      myRead.params.hash = myhash;
      
      var times = 1;
      while (myRead.executeStep())
      {      
	var hash = myRead.getUTF8String(0);
	var count = myRead.getInt64(4);
	var date = myRead.getUTF8String(5);
	
	this.debug(myRead);
	if (myRead.getIsNull(6)) alert("Param "+ myRead.getColumnName(6) +" was null");
	alert("Result 0: "+myRead.getUTF8String(5));
	alert("Col returned: " + myRead.columnCount + " Param Name: " + myRead.getParameterName(0));
	myUpdate.params.times = count + 9;
	myUpdate.params.hash = hash;
	myUpdate.execute();
	myUpdate.finalize();
	alert(times + " executed demo SQL statement for " + hash + " at count " + count + ' on date ' + date);	
	times++;
      }
      
      myRead.reset();
      myRead.params.hash = myhash;
      while (myRead.executeStep())
      {
	var hash = myRead.getUTF8String(0);
	var count = myRead.getInt64(4);
	
	alert("Re-read " + hash + " as " + count + " times.");
      }
    }
    catch(err)
    {
	throw new Error("CertWatch: Error at demo: "+ err);      
    }
  },
  
  // This code was written by Tyler Akins and has been placed in the
  // public domain.  It would be nice if you left this header intact.
  // Base64 code from Tyler Akins -- http://rumkin.com
  base64_encode: function (input)
  {
    var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var output = new StringMaker();
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0;
    
    while (i < input.length)
    {
      chr1 = input[i++];
      chr2 = input[i++];
      chr3 = input[i++];
      
      enc1 = chr1 >> 2;
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
      enc4 = chr3 & 63;
      
      if (isNaN(chr2))
      {
	enc3 = enc4 = 64;
      } else if (isNaN(chr3))
      {
	enc4 = 64;
      }
      
      output.append(keyStr.charAt(enc1) + keyStr.charAt(enc2) +
		    keyStr.charAt(enc3) + keyStr.charAt(enc4));
    }
   
    return output.toString();
  }, 

  base64_decode: function (input)
  {
    var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var output = new StringMaker();
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0;
    
    // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
    
    while (i < input.length)
    {
      enc1 = keyStr.indexOf(input.charAt(i++));
      enc2 = keyStr.indexOf(input.charAt(i++));
      enc3 = keyStr.indexOf(input.charAt(i++));
      enc4 = keyStr.indexOf(input.charAt(i++));
      
      chr1 = (enc1 << 2) | (enc2 >> 4);
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      chr3 = ((enc3 & 3) << 6) | enc4;
      
      output.append(String.fromCharCode(chr1));
      
      if (enc3 != 64)
      {
	output.append(String.fromCharCode(chr2));
      }
      if (enc4 != 64)
      {
	output.append(String.fromCharCode(chr3));
      }
    }
    
    return output.toString();
  }
};

var StringMaker = function()
{
  this.str = "";
  this.length = 0;
  this.append = function (s)
  {
    this.str += s;
    this.length += s.length;
  }
  this.prepend = function (s)
  {
    this.str = s + this.str;
    this.length += s.length;
  }
  this.toString = function ()
  {
    return this.str;
  }
};


window.addEventListener("load", function(e) { certwatch.onLoad(e); }, false);
