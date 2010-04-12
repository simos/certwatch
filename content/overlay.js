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

var CertWatch =
{
  // Initialises the object, by initialising the DB structures
  // and updating the root certificate store in the SQLite database.
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

  // Provides the menu item under Tools.
  onMenuItemCommand: function(e)
  {
    var promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                                  .getService(Ci.nsIPromptService);
    promptService.alert(window, this.strings.getString("helloMessageTitle"),
                                this.strings.getString("helloMessage"));
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
      CertWatch.onSecurePageLoad(doc);
    }
  },

  // Perform a one-off initialisation of the database file (SQLite).
  // Also, initialise the prepared SQLite statements.
  dbinit: function()
  {
    this.dbHandle = null;

    try
    {
      var file = Cc["@mozilla.org/file/directory_service;1"]
                 .getService(Ci.nsIProperties)
                 .get("ProfD", Ci.nsIFile);
      var storage = Cc["@mozilla.org/storage/service;1"]
                    .getService(Ci.mozIStorageService);
      file.append("CertWatchDB.sqlite");

      // Must be checked before openDatabase()
      var dbExists = file.exists();

      // Now, CertWatchDB.sqlite exists
      this.dbHandle = storage.openDatabase(file);

      // CertWatchDB.sqlite initialization
      if (!dbExists)
      {

        this.dbHandle.executeSimpleSQL(sqliteStrings.dbTableVersionCreate);
        this.dbHandle.executeSimpleSQL(sqliteStrings.dbTableVersionInsert);
        this.dbHandle.executeSimpleSQL(sqliteStrings.dbTableCertificatesRoot);
        this.dbHandle.executeSimpleSQL(sqliteStrings.dbTableCertificatesWebsite);
        this.dbHandle.executeSimpleSQL(sqliteStrings.dbTableVisitsWebsite);
      }


      // Create SQLite prepared statements
      this.dbSelectCertsRoot =
          this.dbHandle.createStatement(sqliteStrings.dbSelectStringCertificatesRoot);
      this.dbSelectCertsRootHash =
          this.dbHandle.createStatement(sqliteStrings.dbSelectStringCertificatesRootHash);
      this.dbSelectCertsWebsiteHash =
          this.dbHandle.createStatement(sqliteStrings.dbSelectStringCertificatesWebsiteHash);
      this.dbSelectCertsWebsiteCommonName =
          this.dbHandle.createStatement(sqliteStrings.dbSelectStringCertificatesWebsiteCommonName);
      this.dbSelectVisitsCommonName =
          this.dbHandle.createStatement(sqliteStrings.dbSelectStringVisitsCommonName);
      this.dbSelectVisitsHash =
          this.dbHandle.createStatement(sqliteStrings.dbSelectStringVisitsHash);
      this.dbInsertCertsRoot =
          this.dbHandle.createStatement(sqliteStrings.dbInsertStringCertificatesRoot);
      this.dbInsertCertsWebsite =
          this.dbHandle.createStatement(sqliteStrings.dbInsertStringCertificatesWebsite);
      this.dbInsertVisits =
          this.dbHandle.createStatement(sqliteStrings.dbInsertStringVisits);
      this.dbUpdateCertsRootRemoved =
          this.dbHandle.createStatement(sqliteStrings.dbUpdateStringCertificatesRootRemoved);
      this.dbUpdateCertsRootReAdded =
          this.dbHandle.createStatement(sqliteStrings.dbUpdateStringCertificatesRootReAdded);
      this.dbUpdateCertsRootWeb =
          this.dbHandle.createStatement(sqliteStrings.dbUpdateStringCertificatesRootWeb);
      this.dbUpdateCertsWebsite =
          this.dbHandle.createStatement(sqliteStrings.dbUpdateStringCertificatesWebsites);
    }
    catch(err)
    {
      throw new Error("CertWatch: Error initializing SQLite prepared statements: "+ err);
      backupDatabaseFile(file);
    }

    if (!dbExists)
    {
      this.populateRootCertDB();
    }
  },

  // Populates CertWatchDB.sqlite with browser root certificates.
  // It is only invoked the first time Firefox runs with this extension.
  populateRootCertDB: function()
  {
    var moz_x509certdb2 = Cc['@mozilla.org/security/x509certdb;1']
                          .getService(Ci.nsIX509CertDB2);
    var allRootCertificates = moz_x509certdb2.getCerts();
    var enumRootCertificates = allRootCertificates.getEnumerator();
    var countRootCerts = 0;

    while (enumRootCertificates.hasMoreElements())
    {
      var thisElement = enumRootCertificates.getNext();
      var thisCertificate = thisElement.QueryInterface(Ci.nsIX509Cert);

      var rawDER = thisCertificate.getRawDER({});
      var hashDER = this.hash(rawDER, rawDER.length);
      var base64DER = this.base64_encode(rawDER);

      var now = Date();
      var nowAbsolute = Date.parse(now.toString());  // TODO: Not used yet;

      try
      {
        this.dbInsertCertsRoot.bindUTF8StringParameter(0, // "hashCertificate"
				      hashDER);
        this.dbInsertCertsRoot.bindUTF8StringParameter(1, // "derCertificate"
				      base64DER);
        this.dbInsertCertsRoot.bindUTF8StringParameter(2, // "commonNameRoot"
				      thisCertificate.commonName);
        this.dbInsertCertsRoot.bindUTF8StringParameter(3, // "organizationalUnitRoot"
				      thisCertificate.organizationalUnit);
        this.dbInsertCertsRoot.bindUTF8StringParameter(4, // "dateAddedToCertWatch"
				      now);

        this.dbInsertCertsRoot.execute();

        countRootCerts += 1;
      }
      catch (err)
      {
        throw new Error("CertWatch: Error adding root certficates at init: "+ err);
      }
      finally
      {
        this.dbInsertCertsRoot.reset();
      }
    }

    var params = { firefoxCertCount: countRootCerts };

    window.openDialog("chrome://certwatch/content/dialog-intro.xul", "certwatch-init",
		      "chrome,dialog,modal", params);
  },

  // Runs when Firefox starts up. Check for changes in the root certificate
  // DB of the browser, and updates accordingly the SQLite DB.
  // 1. If FirefoxDB certificate exists in CertWatchDB, mark as re-added, if needed.
  // 2. If FirefoxDB certificate does not exist in CertWatchDB, add to CertWatchDB.
  // 3. If CertWatchDB certificate does not exist in FirefoxDB, mark as removed in CertWatchDB.
  updateRootCertificates: function()
  {
    var moz_x509certdb2 = Cc['@mozilla.org/security/x509certdb;1']
			  .getService(Ci.nsIX509CertDB2);
    var allRootCertificates = moz_x509certdb2.getCerts();
    var enumRootCertificates = allRootCertificates.getEnumerator();

    var certwatchCertificates = new Array();
    var certwatchRemovals = new Array();
    var certwatchReAdditions = new Array();

    try
    {
      var count = 1;
      while (this.dbSelectCertsRoot.executeStep())
      {
        var hashCert = this.dbSelectCertsRoot.getUTF8String(0);
        var removalDate = this.dbSelectCertsRoot.getUTF8String(5);
        var readditionDate = this.dbSelectCertsRoot.getUTF8String(6);
        if (!!removalDate)
        {
          certwatchRemovals[hashCert] = removalDate;
          // alert("Adding removal date " + removalDate + typeof removalDate);
        }
        if (!!readditionDate)
        {
          certwatchReAdditions[hashCert] = readditionDate;
          // alert("Adding readdition date " + readditionDate + typeof readditionDate);
        }
        certwatchCertificates[hashCert] = true;
        count++;
      }
      // alert("Recorded " + (count-1) + " certwatch certificates.");

      var now = Date();
      var nowAbsolute = Date.parse(now.toString());  // TODO: Not used yet;

      while (enumRootCertificates.hasMoreElements())
      {
        var thisElement = enumRootCertificates.getNext();
        var thisCertificate = thisElement.QueryInterface(Ci.nsIX509Cert);
        var rawDER = thisCertificate.getRawDER({});
        var hashDER = this.hash(rawDER, rawDER.length);
        var base64DER = this.base64_encode(rawDER);

        if (certwatchCertificates[hashDER] == undefined) // Case 2
        {
          alert("Got a case 2: new Firefox cert " + hashDER + " certificate, " +
        	thisCertificate.commonName + " is added to CertWatchDB");
          this.dbInsertCertsRoot.bindUTF8StringParameter(0,  // "hashCertificate"
        				  hashDER);
          this.dbInsertCertsRoot.bindUTF8StringParameter(1,  // "derCertificate"
        				  this.base64_encode(rawDER));
          this.dbInsertCertsRoot.bindUTF8StringParameter(2,  // "commonNameRoot"
        				  thisCertificate.commonName);
          this.dbInsertCertsRoot.bindUTF8StringParameter(3,  // "organizationalUnitRoot"
        				  thisCertificate.organizationalUnit);
          this.dbInsertCertsRoot.bindUTF8StringParameter(4,  // "dateAddedToCertWatch"
        				  now);

          this.dbInsertCertsRoot.execute();
        }
        else // CertWatchDB has this Firefox Root certificate.
        {
          //  RemovedDate     ReAddedDate
          //       .              .       -> Do nothing.
          //       x              .       -> Set ReAddedDate.
          //       .              x       -> Should not happen :-)
          //       x              x       -> Do nothing. TODO (cmd dates)
          if (certwatchRemovals[hashDER])
          {
              alert("Got a case 1: CertWatchDB cert " + hashDER +
                    " marked as removed, now re-instated.");
              this.dbUpdateCertsRootReAdded.params.hashCertificate = hashDER;
              this.dbUpdateCertsRootReAdded.params.dateReAddedToMozilla = now;

              this.dbUpdateCertsRootReAdded.execute();
          }

          // Delete the reference from certwatchCertificates.
          delete certwatchCertificates[hashDER];
        }
      }

      // certwatchCertificates now has those remaining certs that are missing from FF.
      for (hashCert in certwatchCertificates)
      {
        //  RemovedDate     ReAddedDate
        //       .              .       -> Set RemoveDate.
        //       x              .       -> Do nothing.
        //       .              x       -> Set RemoveDate.
        //       x              x       -> Do Nothing (retains original remove date)
        if (!certwatchRemovals[hashCert])
        {
          alert("Got a case 3: Firefox lost cert " + hashCert + " certificate, " +
        	" marking the RemovedDate in CertWatch");
          this.dbUpdateCertsRootRemoved.params.hashCertificate = hashCert;
          this.dbUpdateCertsRootRemoved.params.dateRemovedFromMozilla = now;

          this.dbUpdateCertsRootRemoved.execute();
        }
      }
    }
    catch (err)
    {
      throw new Error("CertWatch: Error updating root certificates: "+ err);
    }
    finally
    {
      this.dbSelectCertsRoot.reset();
      this.dbInsertCertsRoot.reset();
      this.dbUpdateCertsRootRemoved.reset();
      this.dbUpdateCertsRootRemoved.reset();
    }
  },

  // Invoked when an https page is loaded.
  // TODO: Investigate whether to hook into the SSL/TLS component of NSS.
  //       This brings about six hits per https document loaded, possibly due
  //       to not pipelining?
  onSecurePageLoad: function(doc)
  {
    var serverCert;
    var validity;

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

    var certArray = serverCert.getChain();
    var certEnumerator = certArray.enumerate();

    //var statementSearchForRoot = this.dbSelectCertsRootHash;
    //var statementUpdateRoot = this.dbUpdateCertsRoot;

    var firstTime = true;

    while (certEnumerator.hasMoreElements())
    {
      var chainCert = certEnumerator.getNext().QueryInterface(Ci.nsIX509Cert);
      var rawDER = chainCert.getRawDER({});
      var hashDER = this.hash(rawDER, rawDER.length);
      var base64DER = this.base64_encode(rawDER);

      if (firstTime)
      {
        firstTime = false;
        this.doWebsiteCertificateWasAccessed(hashDER,
					     chainCert,
					     base64DER,
               gBrowser.contentDocument.URL);
        this.doAddWebsiteVisit(hashDER,
			       chainCert.commonName,
			       gBrowser.contentDocument.URL,
			       gBrowser.contentDocument.referrer);
      }
      else
      {
        this.doRootCertificateWasAccessed(hashDER, chainCert, gBrowser.contentDocument.URL);
      }
    }
  },

  writeCertificateFile: function (rawDER, len, filepath)
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
    stream.writeByteArray(rawDER, len);

    if (stream instanceof Ci.nsISafeOutputStream) {
        stream.finish();
    } else {
        stream.close();
    }
  },

  // Performs a SHA265 hash on the parameter data.
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

  // Case: the user visited a secure website which references root cert 'hashDER'.
  //   	Caveat A: We assume root cert exists in browser root cert collection.
  // 1. Search root certs (in SQLite DB) for hashDER. Cache the results
  // 2. Update the rootCert data for said certificate.
  //		dateFirstUsed -> if null, dateFirstUsed = current timedate.
  //		dateLastUsed -> current timedate.
  //		countTimesUsed -> +1
  doRootCertificateWasAccessed: function(hashDER, cert, URL)
  {
    try
    {
      this.dbSelectCertsRootHash.params.hash = hashDER;

      if (this.dbSelectCertsRootHash.executeStep())
      {
        var now = Date();
        var nowAbsolute = Date.parse(now.toString());  // TODO: Not used yet;

        var storedRootCertFirstUsed = this.dbSelectCertsRootHash.getUTF8String(7);
        var storedRootCertLastUsed  = this.dbSelectCertsRootHash.getUTF8String(8);
        var storedRootCertTimesUsed = this.dbSelectCertsRootHash.getInt64(9);
        var storedRootCertFirstNull = this.dbSelectCertsRootHash.getIsNull(7);

        this.dbUpdateCertsRootWeb.params.hashCertificate = hashDER;

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

        //alert("Updated root cert " + hashDER + " for date " + now + " at " +
        //			    (storedRootCertTimesUsed + 1) + " times.");

        validity = cert.validity.QueryInterface(Ci.nsIX509CertValidity);
        var params = { URL: URL, cert: cert, validity: validity };

        window.openDialog("chrome://certwatch/content/dialog-root-access.xul",
                          "certwatch-root-access",
                          "chrome,dialog,modal", params);

        this.dbUpdateCertsRootWeb.execute();
      }
      else
      {
        alert("Root certificate " + hashDER + " was not found.");
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

  // Case: the user visited a secure website with certificate hash 'hashDER'.
  // 1. Search root certs (in SQLite DB) for hashDER. Cache the results
  // 2. Update the rootCert data for said certificate.
  //		dateFirstUsed -> if null, dateFirstUsed = current timedate.
  //		dateLastUsed -> current timedate.
  //		countTimesUsed -> +1
  doWebsiteCertificateWasAccessed: function(hashDER, cert, base64DER, URL)
  {
    var now = Date();
    var nowAbsolute = Date.parse(now.toString());  // Not used yet;

    try
    {
      this.dbSelectCertsWebsiteHash.params.hash = hashDER;

      if (this.dbSelectCertsWebsiteHash.executeStep())
      {
        var storedWebsiteFirstVisit = this.dbSelectCertsWebsiteHash.getUTF8String(3);
        var storedWebsiteLastVisit  = this.dbSelectCertsWebsiteHash.getUTF8String(4);
        var storedWebsiteTimesVisited = this.dbSelectCertsWebsiteHash.getInt64(5);
        var storedWebsiteFirstNull = this.dbSelectCertsWebsiteHash.getIsNull(3);

        this.dbUpdateCertsWebsite.params.hashCertificate = hashDER;

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

        //alert("Updated website cert of " + cert.commonName + " for date " + now + " with " +
        //			    hashDER + " hash.");

        this.dbUpdateCertsWebsite.execute();

        var validity = cert.validity.QueryInterface(Ci.nsIX509CertValidity);
        var params = { URL: URL, cert: cert, validity: validity, firstTime: false };

        window.openDialog("chrome://certwatch/content/dialog-website-access.xul",
                          "certwatch-website-access",
                          "chrome,dialog,modal", params);
      }
      else
      {
        this.dbInsertCertsWebsite.bindUTF8StringParameter(0, hashDER);
        this.dbInsertCertsWebsite.bindUTF8StringParameter(1, base64DER);
        this.dbInsertCertsWebsite.bindUTF8StringParameter(2, cert.commonName);
        this.dbInsertCertsWebsite.bindUTF8StringParameter(3, now);
        this.dbInsertCertsWebsite.bindUTF8StringParameter(4, now);
        this.dbInsertCertsWebsite.bindInt64Parameter(5, 1);

        this.dbInsertCertsWebsite.execute();

        var validity = cert.validity.QueryInterface(Ci.nsIX509CertValidity);
        var params = { URL: URL, cert: cert, validity: validity, firstTime: true };

        window.openDialog("chrome://certwatch/content/dialog-website-access.xul",
                          "certwatch-website-access",
                          "chrome,dialog,modal", params);

        //alert("Inserted website cert of " + cert.commonName + " for date " + now + " with " +
        //			    hashDER + " hash.");
      }
    }
    catch(err)
    {
      throw new Error("CertWatch: Error at doWebsiteCertificateWasAccessed: "+ err);
    }
    finally
    {
      this.dbSelectCertsWebsiteHash.reset();
      this.dbInsertCertsWebsite.reset();
      this.dbUpdateCertsWebsite.reset();
    }
  },

  // Case: the user visited a secure website.
  // 1. Add an entry to Visits table,
  //		canonicalName -> as reported by the certificate.
  //		hashCertificate -> hash of DER of website certificate.
  //		timedate of visit -> `now`.
  //		URL -> full URL of website.
  //		Referer -> referer, if any.
  doAddWebsiteVisit: function(hashDER, CN, URL, REFERER)
  {
    var now = Date();
    var nowAbsolute = Date.parse(now.toString());  // Not used yet;

    try
    {
      this.dbInsertVisits.bindUTF8StringParameter(0, CN);
      this.dbInsertVisits.bindUTF8StringParameter(1, hashDER);
      this.dbInsertVisits.bindUTF8StringParameter(2, now);
      this.dbInsertVisits.bindUTF8StringParameter(3, URL);
      this.dbInsertVisits.bindUTF8StringParameter(4, REFERER);

      this.dbInsertVisits.execute();
      //alert("Inserted visit to " + URL + " for date " + now + " with CN " +
			//	    CN + ", ref: " + REFERER);
    }
    catch(err)
    {
      throw new Error("CertWatch: Error at doAddWebsiteVisit: "+ err);
    }
    finally
    {
      this.dbInsertVisits.reset();
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

// Part of decode/encode BASE64.
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


window.addEventListener("load", function(e) { CertWatch.onLoad(e); }, false);
