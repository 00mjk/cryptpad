config = {
    "document": {
        "fileType": "docx",
        "key": "Khirz6zTPdfd7",
        "title": "test.docx",
        "url": "/onlyoffice/test.docx"
    },
    "documentType": "text",
    "editorConfig": {
                        "user": {
                        "id": "c0c3bf82-20d7-4663-bf6d-7fa39c598b1d",
                        "name": "John Smith"
                    }
    },
    "events": {
     "onDocumentStateChange": function(evt) { console.log("in change"); window.top.APP.onLocal(); },
     "onReady": function(evt) { console.log("in onReady"); window.top.onOOReady(); } 
    }
};


var docEditor = new DocsAPI.DocEditor("placeholder", config);

