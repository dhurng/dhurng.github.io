var debug = true;
log = function (args) {
    if (debug === true) {
        console.log(args);
    //    console.table(args);
    }
};

var jsEnabled = true;
var cookiesEnabled = navigator.cookieEnabled;

if(jsEnabled && cookiesEnabled) {
  $("#main-area").removeClass("hidden");
  $("#error-overlay").addClass("hidden");
}

window.pendingChanges = [];
var localId = 1;
var silent = false;
window.lastKnownDeltaId = -1;

var fixedDelay = 500;
var delayMultiplier = 1.0;
var idleMultiplier = 1.0;
var idleCalls = 0;
var currentMode = null;
var isPrivate = null;

// Initial Configurations
editor.getSession().setTabSize(4);
editor.setShowPrintMargin(false);

editor.getSession().on("changeMode", function() {
  var newMode = editor.getSession().getMode()['$id'].replace('ace/mode/','');
  if(currentMode == null){
	  currentMode = newMode;
	  document.getElementById("editor-lang-select").value = newMode
  }
  if(currentMode != newMode){
	 $.ajax({
		      url: '/live/api/' + client.docId + '/' + client.guid + '/' + client.clientId + '/' + currentMode + '/newMode',
		      contentType: "application/json",
		      type: 'POST',
		      data: newMode,
		      success: function (result) {
		    	  currentMode = result;
		    	  document.getElementById("editor-lang-select").value = newMode;
		    	  log("mode changed:"+ newMode);
		      },
		      error: function (result) {
		        log("error in chnaging mode");
                log(result);
		      },
		    });
     }

});

editor.getSession().on('change', function(change) {
  if(window.silent == true) {
    return;
  }

  if(window.pendingChanges.length == 0) {
    change.localId = localId++;
    window.pendingChanges.push({docId: client.docId, clientId: client.clientId, change: change});
    return;
  }
  var previousChange = window.pendingChanges[window.pendingChanges.length - 1].change;
  if(isConsecutiveChange(previousChange, change)) {
    if(change.action[0]=="i") {
      previousChange.end.column = change.end.column;
      previousChange.end.row = change.end.row;
      previousChange.lines[previousChange.lines.length - 1] += change.lines[0];
      for (i = 1; i < change.lines.length; i++)
        previousChange.lines.push(change.lines[i]);
    } else {
      previousChange.start.column = change.start.column;
      previousChange.lines[0] = change.lines[0] + previousChange.lines[0];
    }
  } else {
    change.localId = localId++;
    window.pendingChanges.push({docId: client.docId, clientId: client.clientId, change: change});
  }
});

applyChanges = function() {
  var changesClone = new Array(window.pendingChanges.length);
  var i = window.pendingChanges.length;
  while(i--) changesClone[i] = window.pendingChanges[i];
  editor.getSession().getDocument().applyDeltas(changesClone);
};

udateEditorContent = function(data) {
  // TODO return false if nothing changed so that it can be used to reduce polling
  if (data.length > 0) {
    idleCalls = 0;
    idleMultiplier = 1;
    if(window.pendingChanges.length > 0) {
      for(var i = 0; i < data.length; i++) {
        transformBasedOnList(data[i], window.pendingChanges);
      }
      for(var i = 0; i < window.pendingChanges.length; i++) {
        transformBasedOnList(window.pendingChanges[i], data);
      }
    }
    var remoteChangesArray = [];
    for (index = 0; index < data.length; index++) {
        // needs extra condition? && data[index].change.ignore !== true, to remove issues with not syncing
        //   https://sim.amazon.com/issues/LC-2614
      if (data[index].change &&
          data[index].change.ignore !== true &&
          (data[index] && window.client.clientId != data[index].clientId || !data[0].clientId)) {
        remoteChangesArray.push(data[index].change);
      }
      if(window.lastKnownDeltaId < data[index].deltaId) {
        window.lastKnownDeltaId = data[index].deltaId;
      }
    }
    if (remoteChangesArray.length > 0) {
      window.silent = true;
      for (var i=0; i<remoteChangesArray.length; i++) {
        try {
          // https://sim.amazon.com/issues/LC-2614
          editor.getSession().getDocument().applyDelta(remoteChangesArray[i]);
        } catch(err) {
          log("unable to apply delta the following delta hence ignoring it");
          log(remoteChangesArray[i]);
          log(err);
        }
      }
      window.silent = false;
      window.currentText = editor.getValue();
      window.currentCursor = editor.getCursorPosition();
      window.firstChange = false;
      window.lastKnownDeltaId = data[data.length - 1].deltaId;
    } else {
      window.currentText = editor.getValue();
      window.currentCursor = editor.getCursorPosition();
      window.lastKnownDeltaId = data[data.length - 1].deltaId;
    }
  } else {
    idleCalls++;
    if(idleCalls % 100 == 0) {
      idleMultiplier += 1;
    }
  }
};

updateEditiorMode = function(newMode){
   if(currentMode != newMode){
	   document.getElementById("editor-lang-select").value = newMode;
	   editor.getSession().setMode("ace/mode/"+newMode);
     return true;
   } else {
     return false;
   }
};

updateUsers = function(sharedUsers, status){
	return userManager.syncUsers(sharedUsers, status)
};

(function poll(){

  var delay = 250 * Math.random() + fixedDelay * delayMultiplier * idleMultiplier;
  window.postedDeltas = window.pendingChanges;

  window.pendingChanges = [];

  setTimeout(function(){
    if(!client.guid || !client.clientId || client.guid === "" || client.clientId === "") {
      poll();
      return;
    } else {
      try {
        var pushDocdata = {cursorPosition: editor.getCursorPosition(), dataItems: window.postedDeltas};
        $.ajax({
            url: '/live/api/' + client.docId + '/' + client.guid + '/' + client.clientId + '/' + window.lastKnownDeltaId + '/deltas',
            contentType: "application/json",
            type: 'POST',
            data: JSON.stringify(pushDocdata),
            dataType: "json",
            success: function (result) {
              try {
                var deltas = result.deltas;
                var docMode = result.mode;
                var otherClients = result.otherClients;
                udateEditorContent(deltas);
                updateUsers(otherClients, result.status);
                updateEditiorMode(docMode);
                delayMultiplier = 1.0;
                if( result.documentPrivacy != null)
                    onPrivacyChanged(result.documentPrivacy);
              } catch (err) {
                log(err);
              }
              poll();
            },
            statusCode: {
              403: function() {
                location.reload();
              }
            },
            error: function (data ) {
              delayMultiplier += 0.1;
              if (delayMultiplier > 2) {
                document.getElementById("connection-status").className = "errors";
                document.getElementById("connection-text").innerHTML = "Offline";
              }
              log(data);
              poll();
            }
          }
        );
      } catch (err) {
        delayMultiplier += 0.1;
        if (delayMultiplier > 2) {
          document.getElementById("connection-status").className = "errors";
          document.getElementById("connection-text").innerHTML = "Offline";
        }
        log(err);
        poll();
      }
    }
  }, delay);
})();

modeChanged = function(modeDropdown) {
  editor.getSession().setMode("ace/mode/"+modeDropdown.value);
};

onPrivacyChanged = function(docPrivacy){
    var LABEL_CLOSE_SESSION = "Close Interview Session";
    var LABEL_REOPEN_SESSION = "Reopen Interview Session";
    var TITLE_REOPEN_SESSION = "This session is closed for external users, that means users outside of Amazon network can not currently access the document. If you want to reopen the session,click the button.";
    var TITLE_CLOSE_SESSION = "This session is opened for external users, that means anyone can currently access the document. If you want to close the session,click the button.";
    var CLASS_REOPEN_SESSION = "btn-info";
    var CLASS_CLOSE_SESSION = "btn-warning";

    var buttonPrivacy = $('#button_change_privacy');
    if( docPrivacy.isPrivate != isPrivate){
        isPrivate = docPrivacy.isPrivate;
        buttonPrivacy.text( isPrivate ? LABEL_REOPEN_SESSION : LABEL_CLOSE_SESSION );
        buttonPrivacy.prop('title', isPrivate ? TITLE_REOPEN_SESSION : TITLE_CLOSE_SESSION );
        buttonPrivacy.removeClass( CLASS_REOPEN_SESSION  + " " + CLASS_CLOSE_SESSION );
        buttonPrivacy.addClass( isPrivate ? CLASS_CLOSE_SESSION : CLASS_REOPEN_SESSION );
        buttonPrivacy.prop("disabled", false);
    }
    buttonPrivacy.removeClass("hidden");
}

changePrivacy = function() {
  $.ajax({
          url: '/live/api/' + client.docId + '/' + client.guid  + '/' + client.clientId  + '/' + !isPrivate +  '/privacy',
          contentType: "application/json",
          type: 'POST',
          success: function (result) {
          },
          error: function (result) {
            onPrivacyChanged(isPrivate);
          },
        });
  $('#button_change_privacy').text("please wait...");
  $('#button_change_privacy').prop("disabled", true);
};

