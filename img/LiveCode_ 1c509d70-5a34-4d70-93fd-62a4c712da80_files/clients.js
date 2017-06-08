var guid;
var client = {};

registerNewClient = function () {
  new Fingerprint2().get(function(result, components){
    guid = result;
    setCookie("guid", result, 365);
    $.ajax({
      url : '/live/api/' + doc[0].docId + '/client/'+guid,
      contentType: "application/json",
      type: 'POST',
      data: client.name,
      dataType: 'json',
      success : function(result) {
        client = result;
      },
      error : function(result) {
        log(result);
      }
    });
  });
};


function setCookie(cname, cvalue, exdays) {
  var d = new Date();
  d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
  var expires = "expires="+d.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
};

function getCookie(cname) {
  var name = cname + "=";
  var ca = document.cookie.split(';');
  for(var i = 0; i < ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
};

function checkCookie() {
  client.name = getCookie("myname");
  client.guid = getCookie("guid");
  if (client.name == "" || client.guid == "") {
    var promptOptions = {
      title: "What is your name?",
      size: 'small',
      onEscape: false,
      closeButton: false,
      buttons: {
        confirm: {
          label: "Save"
        }
      },
      callback: function(result) {
        if (result !== null && result !== undefined && result.replace(/\s/g, '') != '') {
          setCookie("myname", result, 365);
          client.name = result;
          registerNewClient();
        } else {
          checkCookie();
        }
      }
    };
    bootbox.prompt(promptOptions);
  } else {
    registerNewClient();
  }
};

checkCookie();

getCursorHtml = function(top, left, height, width, name, color, id){
  var htmlContent = "<div class='custom-cursor-box' style='left: "+left+"px; top: "+top+"px; ; position: absolute; z-index: 5; pointer-events: auto;'> " +
    "<div style='height: "+height+"px; top:0px; position: absolute; border-left: 2px solid "+ color+"; font-size: 0;'></div>" +
    "<div style='background-color: "+color+"; height: 6px; width: 6px; top:-2px; left:-2px; position: absolute; '></div>" +
    "<div class='custom-cursor-name' id='"+name+"' style='top: -14px; left: -2px; white-space: nowrap; color: #fff;font-size: 10px; padding: 2px;position: absolute; opacity: 1; background-color: "+ color+"; display: none;'>"+name+"</div></div>";
  return htmlContent ;
};

$(document).on("mouseover",".custom-cursor-box",
  function(){
    $(this).find(".custom-cursor-name").show();
  }
);

$(document).on("mouseout",".custom-cursor-box",
  function(){
    $(this).find(".custom-cursor-name").hide();
  }
);

createMarker = function(cursorsPosition){
  var marker = {};
  marker.users = [];
  marker.update = function(html, markerLayer, session, config) {
    var start = config.firstRow, end = config.lastRow;
    var cursors = this.users;
    for (var i = 0; i < cursors.length; i++) {
      var user = this.users[i];
      var pos = user.cursor.position;
      if (pos.row < start) {
        continue;
      } else if (pos.row > end) {
        break
      } else {
        // compute cursor position on screen
        // this code is based on ace/layer/marker.js
        var screenPos = session.documentToScreenPosition(pos);

        var height = config.lineHeight;
        var width = config.characterWidth;
        var top = markerLayer.$getTop(screenPos.row, config);
        var left = markerLayer.$padding + screenPos.column * width;
        // can add any html here

        var color = "rgb(" + user.cursor.color.red + "," + user.cursor.color.green + "," + user.cursor.color.blue + ")" ;
        var id = "User" + user.id ;
        var htmlContent =  "<div id ='User"+ user.id + "' style='" +
          "height:"+ height +"px;"+
          "top:"+ top+ "px;"+
          "left:"+ left+ "px; width:"+ width+ "px; position: absolute; border-left: 2px solid "+ color+";'></div>"
        htmlContent = getCursorHtml(top, left, height, width, user.name, color, id);
        html.push(htmlContent);
      }
    }
  };

  marker.setUsers = function(users){
    // TODO return false if nothing changed so that it can be used to reduce polling
    this.users = users ;
    this.redraw();
  };

  marker.redraw = function() {
    this.session._signal("changeFrontMarker");
  };

  marker.addCursor = function(r, c) {
    this.cursors.push({row: r, column: c});
    marker.redraw()
  };

  marker.session = editor.getSession();
  marker.session.addDynamicMarker(marker, true) ;
  return marker ;
};


UserManager = function(){
  var userManager = {};
  userManager.marker = createMarker();

  userManager.previousUsers = {};

  userManager.getUserHtml = function (user) {
      return '<div><span class="dot ' + user.status + '"></span> <span>' + user.name + '</span></div>';
  };

  userManager.syncUsers = function(users, status){
    // TODO return false if nothing changed so that it can be used to reduce polling
    this.marker.setUsers(users);
    if(client.name) {
      document.getElementById("myname").innerHTML = client.name;
      document.getElementById("user-count").innerHTML = users.length + 1;
      document.getElementById("connection-status").className = "online";
      document.getElementById("connection-text").innerHTML = "Connected";
      document.getElementById("users-section-status").className = status;
    }
    var html = '';
    if(users) {
      var changed = false;
      changed = users.length != userManager.previousUsers.length;
      if(changed == false) {
        for (var i = 0; i < users.length; i++) {
          var pUser = userManager.previousUsers[users[i].name];
          var user = users[i];
          if (!pUser || (pUser.name != user.name) || (pUser.status != user.status)) {
            changed = true;
            break;
          }
        }
      }
      if(changed == true) {
        userManager.previousUsers = [];
        userManager.previousUsers.length = users.length;
        for (var i = 0; i < users.length; i++) {
          userManager.previousUsers[users[i].name] = {status: users[i].status, name: users[i].name};
          html += userManager.getUserHtml(users[i]);
        }
        document.getElementById("others").innerHTML = html;
      }
    }

  };
  return userManager ;
};

var userManager = UserManager();
