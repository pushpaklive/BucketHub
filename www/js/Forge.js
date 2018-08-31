$(document).ready(function () {
    prepareAppBucketTree();
    $('#refreshBuckets').click(function () {
      $('#appBuckets').jstree(true).refresh();
    });
  
    $('#createNewBucket').click(function () {
      createNewBucket();
    });
  
    $('#createBucketModal').on('shown.bs.modal', function () {
      $("#newBucketKey").focus();
    })
  });

  function prepareAppBucketTree() {
    console.log("Inside prepareAppBucketTree");
    $("#hiddenDiv").css({"background-color":"white","display":"","height":"100%","width":"100%"})
    $('#appBuckets').jstree({
      'core': {
        'themes': { "icons": true },
        'data': {
          "url": '/api/forge/oss/buckets',
          "dataType": "json",
          'multiple': false,
          "data": function (node) {
            return { "id": node.id };
          }
        }
      },
      'types': {
        'default': {
          'icon': 'glyphicon glyphicon-question-sign'
        },
        '#': {
          'icon': 'glyphicon glyphicon-cloud'
        },
        'bucket': {
          'icon': 'glyphicon glyphicon-folder-open'
        },
        'object': {
          'icon': 'glyphicon glyphicon-file'
        }
      },
      "plugins": ["types", "state", "sort", "contextmenu"],
      contextmenu: { items: autodeskCustomMenu }
    }).on('loaded.jstree', function () {
      $('#appBuckets').jstree('open_all');
    }).bind("activate_node.jstree", function (evt, data) {
      if (data != null && data.node != null && data.node.type == 'object') {
        console.log("on('loaded.jstree' | data-->urn : "+data.node.id);
        $("#forgeViewer").empty();
        var urn = data.node.id;
        console.log("urn here : "+urn);
        getForgeToken(function (access_token) {
          jQuery.ajax({
            url: 'https://developer.api.autodesk.com/modelderivative/v2/designdata/' + urn + '/manifest',
            headers: { 'Authorization': 'Bearer ' + access_token },
            success: function (res) {
              if (res.status === 'success') launchViewer(urn);
              else $("#forgeViewer").html('The translation job still running: ' + res.progress + '. Please try again in a moment.');
            },
            error: function (err) {
              var msgButton = 'This file is not translated yet! ' +
                '<button class="btn btn-xs btn-info" onclick="translateObject()"><span class="glyphicon glyphicon-eye-open"></span> ' +
                'Start translation</button>'
              $("#forgeViewer").html(msgButton);
            }
          });
        })
      }
    });
  }

  function autodeskCustomMenu(autodeskNode) {
    var items;
  
    switch (autodeskNode.type) {
      case "bucket":
        items = {
          uploadFile: {
            label: "Upload file",
            action: function () {
              var treeNode = $('#appBuckets').jstree(true).get_selected(true)[0];
              uploadFile(treeNode);
            },
            icon: 'glyphicon glyphicon-cloud-upload'
          }
        };
        break;
      case "object":
        items = {
          translateFile: {
            label: "Translate",
            action: function () {
              var treeNode = $('#appBuckets').jstree(true).get_selected(true)[0];
              translateObject(treeNode);
            },
            icon: 'glyphicon glyphicon-eye-open'
          }
        };
        console.log("File translation ended");
        break;
    }
  
    return items;
  }


  var viewerApp;

function launchViewer(urn) {
 
  var options = {
    env: 'AutodeskProduction',
    getAccessToken: getForgeToken
  };
  var documentId = 'urn:' + urn;
  $("#hiddenDiv").fadeOut();
  $("#hiddenDiv").css({"display":"none"})
  Autodesk.Viewing.Initializer(options, function onInitialized() {
    viewerApp = new Autodesk.Viewing.ViewingApplication('forgeViewer');
    viewerApp.registerViewer(viewerApp.k3D, Autodesk.Viewing.Private.GuiViewer3D);
    viewerApp.loadDocument(documentId, onDocumentLoadSuccess, onDocumentLoadFailure);
  });
}

function onDocumentLoadSuccess(doc) {
  // We could still make use of Document.getSubItemsWithProperties()
  // However, when using a ViewingApplication, we have access to the **bubble** attribute,
  // which references the root node of a graph that wraps each object from the Manifest JSON.
  var viewables = viewerApp.bubble.search({ 'type': 'geometry' });
  if (viewables.length === 0) {
    console.error('Document contains no viewables.');
    return;
  }

  // Choose any of the avialble viewables
  viewerApp.selectItem(viewables[0].data, onItemLoadSuccess, onItemLoadFail);
}

function onDocumentLoadFailure(viewerErrorCode) {
  console.error('onDocumentLoadFailure() - errorCode:' + viewerErrorCode);
}

function onItemLoadSuccess(viewer, item) {
  //need to test
  console.log("Inside onItemLoadSuccess"+item);
  viewer.setBackgroundColor( 0, 255, 100, 255, 255, 255 );
}

function onItemLoadFail(errorCode) {
  console.error('onItemLoadFail() - errorCode:' + errorCode);
}


function getForgeToken(callback) {
  jQuery.ajax({
    url: '/api/forge/oauth/token',
    success: function (res) {
      callback(res.access_token, res.expires_in)
    }
  });
}

function createNewBucket() {
  console.log("New Bucket initiated*********");
  var bucketKey = $('#newBucketKey').val();
  var policyKey = $('#newBucketPolicyKey').val();
  jQuery.post({
      url: '/api/forge/oss/buckets',
      contentType: 'application/json',
      data: JSON.stringify({ 'bucketKey': bucketKey, 'policyKey': policyKey }),
      success: function (res) {
          $('#appBuckets').jstree(true).refresh();
          $('#createBucketModal').modal('toggle');
      },
      error: function (err) {
          if (err.status == 409)
              alert('Bucket already exists - 409: Duplicated')
          console.log(err);
      }
  });
}

function uploadFile(node) {
  $('#hiddenUploadField').click();
  console.log("uploadFile() called***********");
  $('#hiddenUploadField').change(function () {
      if (this.files.length == 0) return;
      var file = this.files[0];
      switch (node.type) {
          case 'bucket':
              var formData = new FormData();
              formData.append('fileToUpload', file);
              formData.append('bucketKey', node.id);
              console.log("buckey key or node.id ---> " + node.id);
              $.ajax({
                  url: '/api/forge/oss/objects',
                  data: formData,
                  processData: false,
                  contentType: false,
                  type: 'POST',
                  success: function (data) {
                      $('#appBuckets').jstree(true).refresh_node(node);
                  }
              });
              break;
      }
  });
}

function translateObject(node) {
  $("#forgeViewer").empty();
  if (node == null) node = $('#appBuckets').jstree(true).get_selected(true)[0];
  var bucketKey = node.parents[0];
  var objectKey = node.id;
  jQuery.post({
      url: '/api/forge/modelderivative/jobs',
      contentType: 'application/json',
      data: JSON.stringify({ 'bucketKey': bucketKey, 'objectName': objectKey }),
      success: function (res) {
          $("#forgeViewer").html('Translation started! Please try again in a moment.');
      },
  });
}

 
  
  