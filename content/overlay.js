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

    // Add event listener for "DOMContentLoaded".
    this.init();
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

    try
    {
      while (enumRootCertificates.hasMoreElements())
      {
        var thisElement = enumRootCertificates.getNext();
        var thisCertificate = thisElement.QueryInterface(Ci.nsIX509Cert);

        var rawDER = thisCertificate.getRawDER({});
        var hashDER = this.hash(rawDER, rawDER.length);
        var base64DER = Base64.encode(rawDER);

        var now = Date();
        var nowAbsolute = Date.parse(now.toString());  // TODO: Not used yet;

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
    }
    catch (err)
    {
        throw new Error("CertWatch: Error adding root certficates at init: "+ err);
    }
    finally
    {
      this.dbInsertCertsRoot.reset();
    }

    var params = { firefoxCertCount: countRootCerts };

    window.openDialog("chrome://certwatch/content/dialog-intro.xul", "certwatch-init",
		      "chrome,dialog,modal", params);
  },

  // Runs when Firefox starts up. Check for changes in the root certificate
  // DB of the browser, and updates accordingly the SQLite DB.
  // Case #
  // 1. If FirefoxDB certificate does not exist in CertWatchDB, add to CertWatchDB.
  // 2. If FirefoxDB certificate exists in CertWatchDB, mark as re-added, if needed.
  // 3. If CertWatchDB certificate does not exist in FirefoxDB, mark as removed in CertWatchDB.
  updateRootCertificates: function()
  {
    var moz_x509certdb2 = Cc['@mozilla.org/security/x509certdb;1']
                             .getService(Ci.nsIX509CertDB2);
    var allRootCertificates = moz_x509certdb2.getCerts();
    var enumRootCertificates = allRootCertificates.getEnumerator();

    var certwatchCertificates = new Array();
    var certwatchRemovals = new Array();

    try
    {
      // Fill in certwatchCertificates[] with the CertWatchDB root certificates.
      // Also record the hashes of the CertWatchDB roots that have RemovalDate.
      while (this.dbSelectCertsRoot.executeStep())
      {
        var hashCert = this.dbSelectCertsRoot.getUTF8String(0);
        var removalDate = this.dbSelectCertsRoot.getUTF8String(5);
        var readditionDate = this.dbSelectCertsRoot.getUTF8String(6);
        if (!!removalDate)
        {
          certwatchRemovals[hashCert] = { removed: removalDate, 
                                          readded: readditionDate };
        }

        certwatchCertificates[hashCert] = true;
      }

      var now = Date();
      var nowAbsolute = Date.parse(now.toString());  // TODO: Not used yet;

      // For each certificate found in Firefox's root certificate store,
      while (enumRootCertificates.hasMoreElements())
      {
        var thisElement = enumRootCertificates.getNext();
        var thisCertificate = thisElement.QueryInterface(Ci.nsIX509Cert);
        var rawDER = thisCertificate.getRawDER({});
        var hashDER = this.hash(rawDER, rawDER.length);
        var base64DER = Base64.encode(rawDER);

        // If a new Firefox root certificate was found (due to browser update?),
        if (certwatchCertificates[hashDER] == undefined)     //         Case 1
        {
          this.dbInsertCertsRoot.bindUTF8StringParameter(0,  // "hashCertificate"
        				  hashDER);
          this.dbInsertCertsRoot.bindUTF8StringParameter(1,  // "derCertificate"
        				  Base64.encode(rawDER));
          this.dbInsertCertsRoot.bindUTF8StringParameter(2,  // "commonNameRoot"
        				  thisCertificate.commonName);
          this.dbInsertCertsRoot.bindUTF8StringParameter(3,  // "organizationalUnitRoot"
        				  thisCertificate.organizationalUnit);
          this.dbInsertCertsRoot.bindUTF8StringParameter(4,  // "dateAddedToCertWatch"
        				  now);

          this.dbInsertCertsRoot.execute();

          var validity = thisCertificate.validity.QueryInterface(Ci.nsIX509CertValidity);
          var params = { cert: thisCertificate, validity: validity };
          var paramsOut = { clickedAccept: false, clickedCancel: false };

          // Inform that a new root certificate was found in Firefox,
          window.openDialog("chrome://certwatch/content/dialog-new-root-cert.xul",
                            "certwatch-new-root-cert",
                            "chrome,dialog,modal", params, paramsOut);
        }
        else // else both CertWatchDB and Firefox have this root certificate,
        {
          //  RemovedDate(RD) ReAddedDate (RAD)                        Case 2
          // a     .              .       -> Do nothing.
          // b     x              .       -> Set ReAddedDate.
          // c     .              x       -> Should not happen.
          // d     x              x       -> If RAD<RD, Set ReAddedDate.
          if (certwatchRemovals[hashDER]) // If the RemovedDate has been set,
          {   
            if ((!certwatchRemovals[hashDER].readded && 
                  !!certwatchRemovals[hashDER].removed) ||   // If case [b] or
                  this.dateToTime(certwatchRemovals[hashDER].removed) >
                    this.dateToTime(certwatchRemovals[hashDER].readded)) // case [d],
            {
              this.dbUpdateCertsRootReAdded.params.hashCertificate = hashDER;
              this.dbUpdateCertsRootReAdded.params.dateReAddedToMozilla = now;

              this.dbUpdateCertsRootReAdded.execute();

              var validity = thisCertificate.validity.QueryInterface(Ci.nsIX509CertValidity);
              var params = { cert: thisCertificate, validity: validity };
              var paramsOut = { clickedAccept: false, clickedCancel: false };

              window.openDialog("chrome://certwatch/content/dialog-reinstated-root-cert.xul",
                              "certwatch-reinstated-root-cert",
                              "chrome,dialog,modal", params, paramsOut);
            }
          }

          // Delete the reference from certwatchCertificates.
          delete certwatchCertificates[hashDER];
        }
      }

      // 'certwatchCertificates' now has those remaining CertWatchDB certificates
      //                                         that are missing from Firefox.
      for (hashCert in certwatchCertificates)
      {
        //   RemovedDate-RD     ReAddedDate-RAD                  Case 3 Matrix
        // a      .                .       -> Set RemovedDate.
        // b      x                .       -> Do nothing.
        // c      .                x       -> Should not happen.
        // d      x                x       -> If RAD > RD, Set RemovedDate.
        if (!certwatchRemovals[hashCert] ||   // case [a]
              this.dateToTime(certwatchRemovals[hashCert].readded) >
                this.dateToTime(certwatchRemovals[hashCert].removed)) // case [d]
          {
            this.dbUpdateCertsRootRemoved.params.hashCertificate = hashCert;
            this.dbUpdateCertsRootRemoved.params.dateRemovedFromMozilla = now;

            this.dbUpdateCertsRootRemoved.execute();

            /* Prepare to search for hashCert cert in CertWatchDB */
            this.dbSelectCertsRootHash.params.hash = hashCert;

            if (this.dbSelectCertsRootHash.executeStep())
            {
              var removedCertBase64 = this.dbSelectCertsRootHash.getUTF8String(1);
              var removedCertificate = this.convertBase64CertToX509(removedCertBase64);
              var validity = removedCertificate.validity.QueryInterface(Ci.nsIX509CertValidity);
              var params = { cert: removedCertificate, validity: validity };
              var paramsOut = { clickedAccept: false, clickedCancel: false };

              window.openDialog("chrome://certwatch/content/dialog-removed-root-cert.xul",
                                "certwatch-removed-root-cert",
                                "chrome,dialog,modal", params, paramsOut);
            }

            this.dbSelectCertsRootHash.reset();
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
      this.dbSelectCertsRootHash.reset();
      this.dbUpdateCertsRootRemoved.reset();
    }
  },

  // Invoked when an https page is loaded.
  // TODO: Investigate whether to hook into the SSL/TLS component of NSS.
  //       During tests, hooking to NSS brings about six hits per https 
  //       document loaded. (possibly due to not pipelining?)
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
      var base64DER = Base64.encode(rawDER);

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

    if (stream instanceof Ci.nsISafeOutputStream)
    {
        stream.finish();
    }
    else
    {
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

        var validity = cert.validity.QueryInterface(Ci.nsIX509CertValidity);
        var params = { URL: URL, cert: cert, validity: validity, knownCert: true };
        var paramsOut = { clickedAccept: false, clickedCancel: false };

        window.openDialog("chrome://certwatch/content/dialog-root-access.xul",
                          "certwatch-root-access",
                          "chrome,dialog,modal", params, paramsOut);

        this.dbUpdateCertsRootWeb.execute();
      }
      else
      {
        // TODO: Add these to store.
        var validity = cert.validity.QueryInterface(Ci.nsIX509CertValidity);
        var params = { URL: URL, cert: cert, validity: validity, knownCert: false };
        var paramsOut = { clickedAccept: false, clickedCancel: false };

        window.openDialog("chrome://certwatch/content/dialog-root-access.xul",
                          "certwatch-root-access",
                          "chrome,dialog,modal", params, paramsOut);
      }
    }
    catch(err)
    {
      throw new Error("CertWatch: Error at doRootCertificateWasAccessed: "+ err);
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

        this.dbUpdateCertsWebsite.execute();

        var validity = cert.validity.QueryInterface(Ci.nsIX509CertValidity);
        var params = { URL: URL, cert: cert, validity: validity, firstTime: false };
        var paramsOut = { clickedAccept: false, clickedCancel: false };

        window.openDialog("chrome://certwatch/content/dialog-website-access.xul",
                          "certwatch-website-access",
                          "chrome,dialog,modal", params, paramsOut);
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
        var paramsOut = { clickedAccept: false, clickedCancel: false };

        window.openDialog("chrome://certwatch/content/dialog-website-access.xul",
                          "certwatch-website-access",
                          "chrome,dialog,modal", params, paramsOut);
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

  // Converts a base64-encoded certificate into a  structure.
  convertBase64CertToX509: function(base64cert)
  {
    var CertDB = Cc["@mozilla.org/security/x509certdb;1"]
                    .getService(Ci.nsIX509CertDB);

    return CertDB.constructX509FromBase64(base64cert);
  },
  
  dateToTime: function(dateStr)
  {
    var time = new Date(dateStr);
    
    return time;
  }
};

window.addEventListener("load", function(e) { CertWatch.onLoad(e); }, false);
